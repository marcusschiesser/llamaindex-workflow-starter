import {
  type SimpleDocumentStore,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "@vectorstores/core";

export async function getIndex() {
  const storageContext = await storageContextFromDefaults({
    persistDir: "storage",
  });

  const numberOfDocs = Object.keys(
    (storageContext.docStore as SimpleDocumentStore).toDict(),
  ).length;
  if (numberOfDocs === 0) {
    throw new Error(
      "Index not found. Please run `npm run generate` to generate the embeddings of the documents",
    );
  }

  return await VectorStoreIndex.init({ storageContext });
}
