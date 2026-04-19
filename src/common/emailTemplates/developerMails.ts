export function DeleteDeveloper(name: string, reason?: string): string {
  return `
        <div class="">
        <h1>Hello ${name},</h1>
        <h2>Developer account removed</h2>
        <p>Your developer account on Khabi-Teq has been closed by an administrator.</p>
        ${
          reason
            ? `<p><strong>Reason:</strong> ${reason}</p>`
            : ""
        }
        <p>If you believe this was a mistake, please contact support.</p>
    `;
}
