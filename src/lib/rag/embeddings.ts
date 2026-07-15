const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
export const VOYAGE_MODEL = 'voyage-4-lite';
export const EMBEDDING_DIMENSIONS = 512;

export class VoyageConfigError extends Error {}

type VoyageInputType = 'query' | 'document';

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage?: { total_tokens: number };
}

async function callVoyage(input: string[], inputType: VoyageInputType): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new VoyageConfigError('VOYAGE_API_KEY no configurada');

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      input,
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as VoyageEmbeddingResponse;
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// input_type distinguishes document vs. query embeddings — Voyage's asymmetric
// encoding gives better retrieval quality than embedding both sides the same way.
export function embedDocuments(texts: string[]): Promise<number[][]> {
  return callVoyage(texts, 'document');
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await callVoyage([text], 'query');
  return vec;
}
