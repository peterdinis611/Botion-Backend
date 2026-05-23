import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { mkdir, readFile, writeFile, unlink, stat } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import type { UploadedFileRecord } from './uploaded-file.dto';

const TMP_ROOT = join(process.cwd(), 'tmp');
const META_FILENAME = '.uploads.json';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class FilesService implements OnModuleInit {
  async onModuleInit() {
    await mkdir(TMP_ROOT, { recursive: true });
  }

  async upload(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UploadedFileRecord> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes.`,
      );
    }

    const userDir = await this.ensureUserDir(userId);
    const id = randomUUID();
    const ext = extname(file.originalname);
    const storedName = `${id}${ext}`;
    const filePath = join(userDir, storedName);

    await writeFile(filePath, file.buffer);

    const record: UploadedFileRecord = {
      id,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    await this.appendRecord(userId, record);
    return record;
  }

  async list(userId: string): Promise<UploadedFileRecord[]> {
    const meta = await this.readMeta(userId);
    return meta.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
  }

  async getFilePath(userId: string, fileId: string): Promise<string> {
    const record = await this.findRecord(userId, fileId);
    const filePath = join(TMP_ROOT, userId, record.storedName);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException(`File "${fileId}" not found.`);
    }

    return filePath;
  }

  async findRecord(
    userId: string,
    fileId: string,
  ): Promise<UploadedFileRecord> {
    const record = (await this.readMeta(userId)).find((f) => f.id === fileId);
    if (!record) {
      throw new NotFoundException(`File "${fileId}" not found.`);
    }
    return record;
  }

  async remove(userId: string, fileId: string): Promise<boolean> {
    const record = await this.findRecord(userId, fileId);
    const filePath = join(TMP_ROOT, userId, record.storedName);

    try {
      await unlink(filePath);
    } catch {
      // File may already be gone; still update metadata.
    }

    const remaining = (await this.readMeta(userId)).filter(
      (f) => f.id !== fileId,
    );
    await this.writeMeta(userId, remaining);
    return true;
  }

  private async ensureUserDir(userId: string): Promise<string> {
    const userDir = join(TMP_ROOT, userId);
    await mkdir(userDir, { recursive: true });
    return userDir;
  }

  private metaPath(userId: string): string {
    return join(TMP_ROOT, userId, META_FILENAME);
  }

  private async readMeta(userId: string): Promise<UploadedFileRecord[]> {
    try {
      const raw = await readFile(this.metaPath(userId), 'utf-8');
      const parsed = JSON.parse(raw) as UploadedFileRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeMeta(
    userId: string,
    records: UploadedFileRecord[],
  ): Promise<void> {
    await this.ensureUserDir(userId);
    await writeFile(this.metaPath(userId), JSON.stringify(records, null, 2));
  }

  private async appendRecord(
    userId: string,
    record: UploadedFileRecord,
  ): Promise<void> {
    const records = await this.readMeta(userId);
    records.push(record);
    await this.writeMeta(userId, records);
  }
}
