class BaseImageProvider {
  async generate(prompt, options = {}) {
    throw new Error("generate() must be implemented");
  }
}

export default BaseImageProvider;
