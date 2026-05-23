import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      service.set('key1', { name: 'test' });
      expect(service.get('key1')).toEqual({ name: 'test' });
    });

    it('should return null for unknown key', () => {
      expect(service.get('nonexistent')).toBeNull();
    });

    it('should return null when TTL has expired', () => {
      jest.useFakeTimers();
      service.set('ttl-key', 'value', 1000); // 1 second TTL

      jest.advanceTimersByTime(1001);
      expect(service.get('ttl-key')).toBeNull();

      jest.useRealTimers();
    });

    it('should return value when TTL has NOT expired', () => {
      jest.useFakeTimers();
      service.set('ttl-key', 'alive', 5000); // 5 second TTL

      jest.advanceTimersByTime(3000);
      expect(service.get<string>('ttl-key')).toBe('alive');

      jest.useRealTimers();
    });

    it('should store without TTL and never expire', () => {
      jest.useFakeTimers();
      service.set('permanent', 'data');

      jest.advanceTimersByTime(999_999);
      expect(service.get<string>('permanent')).toBe('data');

      jest.useRealTimers();
    });
  });

  describe('delete', () => {
    it('should remove a specific key', () => {
      service.set('del-key', 'value');
      service.delete('del-key');
      expect(service.get('del-key')).toBeNull();
    });

    it('should not throw when deleting a non-existent key', () => {
      expect(() => service.delete('ghost')).not.toThrow();
    });
  });

  describe('clearPattern', () => {
    it('should remove all keys matching the pattern', () => {
      service.set('user:1:notes:archived:false:nb::pin::q::tags:', ['n1']);
      service.set('user:1:notes:archived:true:nb::pin::q::tags:', ['n2']);
      service.set('user:2:notes:archived:false:nb::pin::q::tags:', ['n3']);

      service.clearPattern('user:1:notes:*');

      expect(
        service.get('user:1:notes:archived:false:nb::pin::q::tags:'),
      ).toBeNull();
      expect(
        service.get('user:1:notes:archived:true:nb::pin::q::tags:'),
      ).toBeNull();
      // user:2 key should be untouched
      expect(
        service.get('user:2:notes:archived:false:nb::pin::q::tags:'),
      ).toEqual(['n3']);
    });

    it('should do nothing if no keys match the pattern', () => {
      service.set('user:1:notebooks', []);
      service.clearPattern('user:99:notes:*');
      expect(service.get('user:1:notebooks')).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all cached entries', () => {
      service.set('a', 1);
      service.set('b', 2);
      service.clear();
      expect(service.get('a')).toBeNull();
      expect(service.get('b')).toBeNull();
    });
  });
});
