class BaseAIProvider {
  async complete(prompt, options = {}) {
    throw new Error("complete() must be implemented");
  }
}

export default BaseAIProvider;
