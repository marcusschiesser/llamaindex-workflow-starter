import path from 'node:path'

/**
 * Constructs a stored file path from an ID and optional directory.
 * Uses path.join for cross-platform safety and validates the ID to prevent path traversal.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.id - The file identifier (must not contain path separators).
 * @param {string} [params.saveDir] - Optional directory to save the file. Defaults to "output/uploaded".
 * @returns {string} The full file path.
 * @throws {Error} If the id contains invalid path characters.
 */
export function getStoredFilePath({
  id,
  saveDir,
}: {
  id: string
  saveDir?: string
}): string {
  // Validate id to prevent path traversal and invalid characters
  if (id.includes('/') || id.includes('\\') || id.includes('..')) {
    throw new Error(
      'Invalid file id: path traversal or separators are not allowed.'
    )
  }
  // Use path.join to construct the default directory for cross-platform compatibility
  const directory = saveDir ?? path.join('output', 'uploaded')
  return path.join(directory, id)
}

