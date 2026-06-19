import { describe, it, beforeEach, expect, vi } from 'vitest'
import { generateMoodReport } from '../services/moodReportService'
import type { Conversation } from '../types'

describe('MoodReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateMoodReport', () => {
    it('should return empty report when no conversations', () => {
      const result = generateMoodReport([])

      expect(result).toBeDefined()
      expect(result.moodChart).toEqual([])
      expect(result.frequentWords).toEqual([])
      expect(result.triggers).toEqual([])
      expect(result.aiSummary).toContain('平均情绪值')
    })

    it('should generate report with conversations', () => {
      const conversations: Conversation[] = [
        {
          id: 'conv-1',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: '今天感觉很焦虑',
              timestamp: Date.now()
            }
          ],
          startTime: Date.now()
        }
      ]

      const result = generateMoodReport(conversations)

      expect(result.moodChart).toBeDefined()
      expect(result.frequentWords).toBeDefined()
      expect(result.triggers).toBeDefined()
      expect(result.aiSummary).toBeDefined()
      expect(result.aiSummary).toContain('焦虑')
    })

    it('should extract frequent words correctly', () => {
      const conversations: Conversation[] = [
        {
          id: 'conv-1',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: '我很担心，每天都感到很焦虑',
              timestamp: Date.now()
            }
          ],
          startTime: Date.now()
        }
      ]

      const result = generateMoodReport(conversations)

      // The tokenizer splits on punctuation/whitespace, not by Chinese word
      // segmentation, so phrases are kept whole. Assert that non-stopword
      // phrases are extracted and ranked.
      expect(result.frequentWords.length).toBeGreaterThan(0)
      const allWords = result.frequentWords.map((w: any) => w.word)
      expect(allWords).toContain('我很担心')
      expect(allWords).toContain('每天都感到很焦虑')
    })
  })
})
