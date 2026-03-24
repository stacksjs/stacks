import { describe, expect, it } from 'bun:test'

describe('AI Module', () => {
  describe('exports', () => {
    it('should export types module', async () => {
      const types = await import('../src/types')
      expect(types).toBeDefined()
    })

    it('should export driver factories', async () => {
      const drivers = await import('../src/drivers')
      expect(drivers.createAnthropicDriver).toBeFunction()
      expect(drivers.createOpenAIDriver).toBeFunction()
      expect(drivers.createOllamaDriver).toBeFunction()
      expect(drivers.createClaudeAgentSDKDriver).toBeFunction()
    })

    it('should export estimateTokens from anthropic driver', async () => {
      const drivers = await import('../src/drivers')
      expect(drivers.estimateTokens).toBeFunction()
    })

    it('should export image module functions', async () => {
      const imageModule = await import('../src/image')
      expect(imageModule.generateImage).toBeFunction()
      expect(imageModule.editImage).toBeFunction()
      expect(imageModule.createImageVariation).toBeFunction()
      expect(imageModule.analyzeImage).toBeFunction()
      expect(imageModule.analyzeImages).toBeFunction()
      expect(imageModule.image).toBeDefined()
    })

    it('should export search module functions', async () => {
      const searchModule = await import('../src/search')
      expect(searchModule.createEmbedding).toBeFunction()
      expect(searchModule.cosineSimilarity).toBeFunction()
      expect(searchModule.dotProduct).toBeFunction()
      expect(searchModule.euclideanDistance).toBeFunction()
      expect(searchModule.VectorIndex).toBeDefined()
      expect(searchModule.rag).toBeFunction()
      expect(searchModule.chunkText).toBeFunction()
      expect(searchModule.indexText).toBeFunction()
    })

    it('should export buddy module functions', async () => {
      const buddyModule = await import('../src/buddy')
      expect(buddyModule.CONFIG).toBeDefined()
      expect(buddyModule.buddyState).toBeDefined()
      expect(buddyModule.getDriver).toBeFunction()
      expect(buddyModule.getAvailableDrivers).toBeFunction()
      expect(buddyModule.buildSystemPrompt).toBeFunction()
      expect(buddyModule.processCommand).toBeFunction()
    })

    it('should export text module (or gracefully handle missing aws dep)', async () => {
      try {
        const textModule = await import('../src/text')
        expect(textModule.summarize).toBeFunction()
        expect(textModule.ask).toBeFunction()
      }
      catch (e: any) {
        // ts-cloud/aws may not be installed — verify the error is a module resolution issue
        expect(e.message).toContain('Cannot find module')
      }
    })
  })

  describe('Driver factory pattern', () => {
    it('should create an Anthropic driver with config', async () => {
      const { createAnthropicDriver } = await import('../src/drivers')
      const driver = createAnthropicDriver({ apiKey: 'test-key' })
      expect(driver).toBeDefined()
      expect(driver.name).toBe('Claude API')
      expect(driver.process).toBeFunction()
    })

    it('should create an OpenAI driver with config', async () => {
      const { createOpenAIDriver } = await import('../src/drivers')
      const driver = createOpenAIDriver({ apiKey: 'test-key' })
      expect(driver).toBeDefined()
      expect(driver.name).toBe('OpenAI')
      expect(driver.process).toBeFunction()
    })

    it('should create an Ollama driver with config', async () => {
      const { createOllamaDriver } = await import('../src/drivers')
      const driver = createOllamaDriver({ host: 'http://localhost:11434', model: 'llama3.2' })
      expect(driver).toBeDefined()
      expect(driver.name).toBe('Ollama')
      expect(driver.process).toBeFunction()
    })

    it('should list available drivers', async () => {
      const { getAvailableDrivers } = await import('../src/buddy')
      const drivers = getAvailableDrivers()
      expect(drivers).toBeArray()
      expect(drivers).toContain('claude-cli-local')
      expect(drivers).toContain('claude')
      expect(drivers).toContain('openai')
      expect(drivers).toContain('ollama')
      expect(drivers).toContain('mock')
    })

    it('should throw on unknown driver name', async () => {
      const { getDriver } = await import('../src/buddy')
      expect(() => getDriver('nonexistent-driver')).toThrow('Unknown driver')
    })
  })

  describe('Search utilities (pure functions)', () => {
    it('should compute cosine similarity between identical vectors', async () => {
      const { cosineSimilarity } = await import('../src/search')
      const v = [1, 2, 3]
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5)
    })

    it('should compute cosine similarity between orthogonal vectors', async () => {
      const { cosineSimilarity } = await import('../src/search')
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5)
    })

    it('should compute dot product correctly', async () => {
      const { dotProduct } = await import('../src/search')
      expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32) // 1*4 + 2*5 + 3*6
    })

    it('should compute euclidean distance correctly', async () => {
      const { euclideanDistance } = await import('../src/search')
      expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5, 5)
    })

    it('should throw on vector dimension mismatch', async () => {
      const { cosineSimilarity } = await import('../src/search')
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Vector dimensions must match')
    })
  })

  describe('Text chunking', () => {
    it('should chunk text into segments', async () => {
      const { chunkText } = await import('../src/search')
      const text = 'line1\nline2\nline3\nline4\nline5'
      const chunks = chunkText(text, { chunkSize: 15, chunkOverlap: 0 })
      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        expect(chunk.length).toBeGreaterThan(0)
      }
    })

    it('should return single chunk for short text', async () => {
      const { chunkText } = await import('../src/search')
      const chunks = chunkText('short text', { chunkSize: 1000 })
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe('short text')
    })
  })

  describe('Image generation interface', () => {
    it('should throw when OPENAI_API_KEY is missing', async () => {
      const originalKey = process.env.OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY

      const { generateImage } = await import('../src/image')
      await expect(generateImage('a cat')).rejects.toThrow('OPENAI_API_KEY')

      if (originalKey) process.env.OPENAI_API_KEY = originalKey
    })

    it('should throw for unsupported provider', async () => {
      const { generateImage } = await import('../src/image')
      await expect(
        generateImage('a cat', { provider: 'ollama' as any }),
      ).rejects.toThrow('not supported')
    })

    it('should export image namespace object with expected methods', async () => {
      const { image } = await import('../src/image')
      expect(image.generate).toBeFunction()
      expect(image.edit).toBeFunction()
      expect(image.variation).toBeFunction()
      expect(image.analyze).toBeFunction()
      expect(image.analyzeMultiple).toBeFunction()
    })
  })

  describe('Buddy config and state', () => {
    it('should have valid CONFIG structure', async () => {
      const { CONFIG } = await import('../src/buddy')
      expect(CONFIG.workDir).toBeString()
      expect(CONFIG.commitMessage).toBeString()
      expect(CONFIG.ollamaHost).toBeString()
      expect(CONFIG.ollamaModel).toBeString()
    })

    it('should provide state manager with expected methods', async () => {
      const { buddyState } = await import('../src/buddy')
      expect(buddyState.getState).toBeFunction()
      expect(buddyState.setRepo).toBeFunction()
      expect(buddyState.setCurrentDriver).toBeFunction()
      expect(buddyState.setGitHub).toBeFunction()
      expect(buddyState.addToHistory).toBeFunction()
      expect(buddyState.clearHistory).toBeFunction()
    })

    it('should build system prompt with no repo context', async () => {
      const { buildSystemPrompt, buddyState } = await import('../src/buddy')
      buddyState.setRepo(null)
      const prompt = buildSystemPrompt('some context')
      expect(prompt).toContain('Buddy')
      expect(prompt).toContain('No repository is currently open')
    })
  })
})
