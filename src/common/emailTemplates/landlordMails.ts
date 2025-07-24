export function deleteLandlordMail(name: string, reason: string): string {
	return `
        <div class="">
        <h1> Hello ${name},</h1>
        <h2>Landlord Account Deleted</h2>
        <p>Your landlord account has been deleted. Due to: </p>
        ${
            reason
                ? `<p><strong>Reason:</strong> ${reason}</p>`
                : ""
        }
    `;
}