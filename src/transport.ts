// /src/transport.ts

import { TrackPayload } from "./types";

export const sendLog = async (
  apiKey: string,
  environment: string,
  data: TrackPayload,
) => {
  await fetch("http://localhost:8000/api/ingestion", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },

    body: JSON.stringify({
      environment,
      occurredAt: new Date(),

      ...data,
    }),
  });
};
