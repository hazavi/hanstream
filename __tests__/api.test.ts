import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchDrama,
  fetchEpisode,
  fetchSearch,
  fetchRecent,
  fetchPopular,
  fetchPopularSeries,
  clearCache,
  formatRelativeTime,
} from '../lib/api';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  describe('fetchDrama', () => {
    it('should fetch drama details successfully', async () => {
      const mockData = {
        result: {
          title: 'Test Drama',
          image: 'https://example.com/image.jpg',
          description: 'A test drama',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchDrama('test-drama');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://kdrama-one.vercel.app/test-drama',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchDrama('non-existent')).rejects.toThrow();
    });

    it('should use cache for repeated requests', async () => {
      const mockData = {
        result: { title: 'Cached Drama' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      // First call
      await fetchDrama('test-drama');
      // Second call (should use cache)
      await fetchDrama('test-drama');

      // Fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchEpisode', () => {
    it('should fetch episode data successfully', async () => {
      const mockData = {
        result: {
          title: 'Episode 1',
          video: 'https://example.com/video.mp4',
          episodes: [{ id: '/ep/1', type: 'SUB' }],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchEpisode('test-drama', '1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://kdrama-one.vercel.app/test-drama/episode/1',
        expect.any(Object)
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchSearch', () => {
    it('should search dramas with query', async () => {
      const mockData = {
        results: [
          { title: 'Test Drama', image: 'test.jpg', 'detail-link': '/test' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchSearch('test drama');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search?q='),
        expect.any(Object)
      );
      expect(result.results).toHaveLength(1);
    });

    it('should handle search with pagination', async () => {
      const mockData = {
        results: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await fetchSearch('test', 2);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('&page=2'),
        expect.any(Object)
      );
    });
  });

  describe('fetchRecent', () => {
    it('should fetch recent dramas', async () => {
      const mockData = {
        results: [
          {
            title: 'Recent Drama',
            image: 'recent.jpg',
            'episode-link': '/recent/episode/1',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchRecent();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://kdrama-one.vercel.app/recently-added',
        expect.any(Object)
      );
      expect(result.results).toHaveLength(1);
    });
  });

  describe('fetchPopular', () => {
    it('should fetch popular dramas', async () => {
      const mockData = {
        results: [
          { title: 'Popular Drama', image: 'pop.jpg', 'detail-link': '/pop' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchPopular();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://kdrama-one.vercel.app/popular',
        expect.any(Object)
      );
      expect(result.results).toHaveLength(1);
    });
  });

  describe('fetchPopularSeries', () => {
    it('should fetch top dramas', async () => {
      const mockData = {
        result: {
          periods: {
            week: [{ title: 'Top Drama', rank: 1, slug: 'top' }],
            month: [],
            day: [],
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchPopularSeries();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://kdrama-one.vercel.app/top-dramas',
        expect.any(Object)
      );
      expect(result.result.periods.week).toHaveLength(1);
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "Just now" for very recent times', () => {
      const now = new Date();
      const result = formatRelativeTime(now.toISOString());
      expect(result).toBe('Just now');
    });

    it('should format minutes correctly', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinutesAgo.toISOString());
      expect(result).toBe('5 minutes ago');
    });

    it('should format hours correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      const result = formatRelativeTime(twoHoursAgo.toISOString());
      expect(result).toBe('2 hours ago');
    });

    it('should format days correctly', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
      const result = formatRelativeTime(threeDaysAgo.toISOString());
      expect(result).toBe('3 days ago');
    });

    it('should format weeks correctly', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
      const result = formatRelativeTime(twoWeeksAgo.toISOString());
      expect(result).toBe('2 weeks ago');
    });

    it('should handle already formatted strings', () => {
      const result = formatRelativeTime('4 minutes ago');
      expect(result).toBe('4 minutes ago');
    });

    it('should handle invalid dates', () => {
      const result = formatRelativeTime('invalid-date');
      expect(result).toBe('invalid-date');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when clearCache is called', async () => {
      const mockData = { result: { title: 'Test' } };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      // First call
      await fetchDrama('test');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearCache();

      // Second call after cache clear
      await fetchDrama('test');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
