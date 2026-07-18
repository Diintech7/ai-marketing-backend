import StabilityProvider from "./StabilityProvider.js";
import PollinationsProvider from "./PollinationsProvider.js";
import HuggingFaceProvider from "./HuggingFaceProvider.js";

const providers = {
  stability: StabilityProvider,
  pollinations: PollinationsProvider,
  huggingface: HuggingFaceProvider,
};

const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "pollinations";

const provider = new (providers[IMAGE_PROVIDER] || PollinationsProvider)();

export default provider;
