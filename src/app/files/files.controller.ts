import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { HttpAuthGuard } from '../../auth/http-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/current-user.decorator';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Controller('files')
@UseGuards(HttpAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadFile(
    @CurrentUser() currentUser: JwtPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.filesService.upload(currentUser.sub, file);
  }

  @Get()
  async listFiles(@CurrentUser() currentUser: JwtPayload) {
    return this.filesService.list(currentUser.sub);
  }

  @Get(':id')
  async downloadFile(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const record = await this.filesService.findRecord(currentUser.sub, id);
    const filePath = await this.filesService.getFilePath(currentUser.sub, id);

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(record.originalName)}"`,
    );
    return res.sendFile(filePath);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFile(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.filesService.remove(currentUser.sub, id);
  }
}
