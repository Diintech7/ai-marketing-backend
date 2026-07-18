import axios from "axios";

const META_VERSION = process.env.META_API_VERSION || "v19.0";
const BASE_URL = `https://graph.facebook.com/${META_VERSION}`;

export const metaClient = (accessToken) =>
  axios.create({
    baseURL: BASE_URL,
    params: { access_token: accessToken },
    timeout: 15000,
  });

export const META_VERSION_URL = BASE_URL;
