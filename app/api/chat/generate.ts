import {
  storageContextFromDefaults,
  VectorStoreIndex,
} from "@vectorstores/core";
import { SimpleDirectoryReader } from "@vectorstores/readers/directory";
import { initSettings } from "./app/settings";

async function generateDatasource() {
  console.log(`Generating storage context...`);
  // Split documents, create embeddings and store them in the storage context
  const storageContext = await storageContextFromDefaults({
    persistDir: "storage",
  });
  // load documents from current directory into an index
  const reader = new SimpleDirectoryReader();
  const documents = await reader.loadData("data");

  await VectorStoreIndex.fromDocuments(documents, {
    storageContext,
  });
  console.log("Storage context successfully generated.");
}

(async () => {
  initSettings();
  await generateDatasource();
})();
