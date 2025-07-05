// import { RouteError } from "../../common/classes";
// import { DB } from "..";
// import HttpStatusCodes from "../../common/HttpStatusCodes";
// import {
//   confirmTemplate,
//   CounterBuyerTemplate,
//   CounterSellerTemplate,
//   declineTemplate,
//   generalTemplate,
//   InspectionAcceptedTemplate,
//   InspectionRequestWithNegotiation,
//   InspectionRequestWithNegotiationSellerTemplate,
//   LOIAcceptedSellerTemplate,
//   LOICounterBuyerTemplate,
//   LOICounterSellerTemplate,
//   LOINegotiationAcceptedTemplate,
//   LOIRejectedBuyerTemplate,
//   NegotiationAcceptedSellerTemplate,
//   NegotiationAcceptedTemplate,
//   NegotiationLOIAcceptedSellerTemplate,
//   NegotiationLOIRejectedSellerTemplate,
//   NegotiationRejectedBuyerTemplate,
//   NegotiationRejectedSellerTemplate,
//   unavailableTemplate,
// } from "../../common/email.template";
// import sendEmail from "../../common/send.email";
// import mongoose from "mongoose";


// class DocumentVerificationController {

//    public async submitDocumentVerification(req: Request, res: Response){
//   const { email, phoneNumber, address } = req.body;
//   const documents = req.files?.map((file: any) => file.path);

//   if (!documents || documents.length > 2) {
//     return res.status(400).json({ error: 'You can only submit a maximum of 2 documents per submission.' });
//   }

//   const existingUser = await DB.Models.User.findOne({ email }).lean();
//   const existingBuyer = await DB.Models.Buyer.findOne({ email }).lean();
//   const existingSubmission = await DB.Models.DocumentVerification.findOne({ email });

//   if (existingSubmission) {
//     existingSubmission.documents.push(...documents);
//     await existingSubmission.save();

//     return res.status(200).json({
//       success: true,
//       message: 'Documents appended to existing verification',
//       verification: existingSubmission,
//     });
//   }

//   if (existingUser || existingBuyer || (!existingUser && !existingBuyer)) {
//     const verification = await DB.Models.DocumentVerification.create({
//       email,
//       phoneNumber,
//       address,
//       documents,
//     });

//     return res.status(201).json({ success: true, message: 'Documents submitted successfully', verification });
//   }
// };
// }


// export const documentVerificationController = new DocumentVerificationController();
