


export function PropertyApprovedOrDisapprovedTemplate(
	name: string,
	status: string,
	data: any
): string {
	return `
<div class="">
                        <h1> Hello ${name},</h1>
                                <h2>Property ${status}</h2>
                                <p>Your property was ${status}. Here are the details:</p>
                                
                                <div class="details">
                                        <p><strong>Property Type:</strong> ${
																																									data.propertyType
																																								}</p>
                                        <p><strong>Location:</strong> ${
																																									data.location.state
																																								}, ${
		data.location.localGovernment ? data.location.localGovernment + ", " : ""
	}${data.location.area}</p>
                                        <p><strong>Price:</strong> ₦${
																																									data.price || data.rentalPrice
																																								}</p>
                                        <p><strong>Number of Bedrooms:</strong> ${
																																									data.propertyFeatures?.noOfBedrooms ||
																																									data.noOfBedrooms
																																								}</p>
                                        <p><strong>Features:</strong> ${
																																									data.propertyFeatures?.additionalFeatures?.join(
																																										", "
																																									) ||
																																									data.features
																																										?.map((f: any) => f.featureName)
																																										.join(", ")
																																								}</p>
                                        <p><strong>Tenant Criteria:</strong> ${
																																									data.tenantCriteria
																																										?.map((c: any) => c.criteria)
																																										.join(", ") || "N/A"
																																								}</p>
                                        <p><strong>Documents on Property:</strong> ${
																																									data.docOnProperty
																																										?.map(
																																											(doc: any) =>
																																												`${doc.docName} (${
																																													doc.isProvided
																																														? "Provided"
																																														: "Not Provided"
																																												})`
																																										)
																																										.join(", ") || "N/A"
																																								}</p>
                                        <p><strong>Usage Options:</strong> ${
																																									data.usageOptions?.join(", ") || "N/A"
																																								}</p>
                                        <p><strong>Availability:</strong> ${
																																									data.isAvailable ? "Yes" : "No"
																																								}</p>
                                        <p><strong>Budget Range:</strong> ${
																																									data.budgetRange || "N/A"
																																								}</p>
                                </div>
                                
                                ${
																																	data.pictures && data.pictures.length
																																		? `
                                <h3>Property Pictures</h3>
                                <div class="pictures">
                                        ${data.pictures
																																									.map(
																																										(pic: any) =>
																																											`<img src="${pic}" alt="Property Image" width="400px" height="400px" style="margin-top: 10px; border-radius: 5px;">`
																																									)
																																									.join("")}
                                </div>
                                `
																																		: ""
																																}
</div>
  `;
}