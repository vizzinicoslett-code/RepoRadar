type ClipboardWriter = Pick<Clipboard, 'writeText'>
export async function copyChatGptPrompt(prompt: string, clipboard: ClipboardWriter | null | undefined = globalThis.navigator?.clipboard): Promise<'copied' | 'fallback'> {
  try {
    if (!clipboard?.writeText) return 'fallback'
    await clipboard.writeText(prompt)
    return 'copied'
  } catch { return 'fallback' }
}
