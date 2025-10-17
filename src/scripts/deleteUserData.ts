// import 'dotenv/config';
// console.log('DEBUG: MONGO_URL at script start:', process.env.MONGO_URL);

// // --- Core Imports ---
// import { DB } from '../controllers'; // Adjust path to your DB config
// import { RouteError } from '../common/classes'; // Adjust path if needed
// import HttpStatusCodes from '../common/HttpStatusCodes'; // Adjust path if needed

// // --- Mongoose connection related imports for explicit connect/disconnect waiting ---
// import { connection } from 'mongoose';


// // The deleteInspectionByEmails function remains the same as our last successful version
// // It performs the deletion logic once the DB is known to be connected.
// async function deleteInspectionByEmails(emails: string[]): Promise<{ message: string; deletedCount: { inspections: number; transactions: number; buyers: number } }> {
//     try {
//         if (!emails || emails.length === 0) {
//             throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'No email addresses provided for deletion.');
//         }

//         // Access DB.Models to ensure the DB class singleton is instantiated
//         // and its constructor (which initiates mongoose.connect) has run.
//         // We don't await anything here, as the explicit await for connection is below.
//         const models = DB.Models; // Just access it once to trigger instantiation

//         const buyersToDelete = await models.Buyer.find({ email: { $in: emails } }).select('_id email');
//         if (buyersToDelete.length === 0) {
//             return { message: 'No buyers found with the provided emails, no data deleted.', deletedCount: { inspections: 0, transactions: 0, buyers: 0 } };
//         }

//         const buyerIdsToDelete = buyersToDelete.map(buyer => buyer._id);
//         const foundEmails = buyersToDelete.map(buyer => buyer.email);
//         console.log(`Found buyers for deletion: ${foundEmails.join(', ')}`);

//         const inspectionsToProcess = await models.InspectionBooking.find({ requestedBy: { $in: buyerIdsToDelete } }).select('transaction');
//         const transactionIdsToDelete = inspectionsToProcess.map(inspection => inspection.transaction).filter(id => id !== undefined && id !== null);
//         const uniqueTransactionIdsToDelete = [...new Set(transactionIdsToDelete.map(String))];

//         const deleteInspectionsResult = await models.InspectionBooking.deleteMany({ requestedBy: { $in: buyerIdsToDelete } });
//         console.log(`Deleted ${deleteInspectionsResult.deletedCount} inspection bookings.`);

//         let deleteTransactionsResult = { deletedCount: 0 };
//         if (uniqueTransactionIdsToDelete.length > 0) {
//             deleteTransactionsResult = await models.Transaction.deleteMany({ _id: { $in: uniqueTransactionIdsToDelete } });
//             console.log(`Deleted ${deleteTransactionsResult.deletedCount} transactions.`);
//         }

//         const deleteBuyersResult = await models.Buyer.deleteMany({ _id: { $in: buyerIdsToDelete } });
//         console.log(`Deleted ${deleteBuyersResult.deletedCount} buyer accounts.`);

//         return {
//             message: `Comprehensive deletion completed for emails: ${foundEmails.join(', ')}.`,
//             deletedCount: {
//                 inspections: deleteInspectionsResult.deletedCount,
//                 transactions: deleteTransactionsResult.deletedCount,
//                 buyers: deleteBuyersResult.deletedCount
//             }
//         };
//     } catch (error) {
//         console.error("Error in deleteInspectionByEmails (Comprehensive Deletion):", error);
//         if (error instanceof RouteError) {
//             throw error;
//         }
//         throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Failed to perform comprehensive deletion due to an internal server error.');
//     }
// }


// // --- Main execution block for the script ---
// (async () => {
//     // ⚠️⚠️⚠️ IMPORTANT: Specify the emails you want to delete here! ⚠️⚠️⚠️
//     const emailsToPurge = [
//         'gatukurh1@gmail.com',
//         'gatukurh1+2@gmail.com',
//         'gatukurh1+3@gmail.com',
//         'gatukurh1+4@gmail.com',
//         'gatukurh1+5@gmail.com',
//         'gatukurh1+6@gmail.com',
//         // ''
//         // 'stephenadeosun411@gmail.com',
//         // 'agbeloba4sem2019@gmail.com',
//         // 'Ajaydy2k6@gmail.com',
//         // 'tahir84@lopvede.com',
//         // 'dimplatlearn@gmail.com',
//         // 'ayowoledamilola25@gmail.com',
//         // 'obolanle961@gmail.com',
//     ];

//     console.log(`Starting data purge for emails: ${emailsToPurge.join(', ')} at ${new Date().toLocaleString()}`);

//     try {
//         // --- Input Validation for MONGO_URL ---
//         if (!process.env.MONGO_URL || process.env.MONGO_URL.trim() === '') {
//             throw new Error('Environment variable MONGO_URL is not set or is empty. Please set it before running the script.');
//         }

//         // --- Establish and wait for DB connection ---
//         // Trigger DB class instantiation (which calls mongoose.connect in its constructor)
//         // by accessing DB.Models. This also ensures models are loaded.
//         DB.Models; // Access it to kick off the connection process

//         // Create a promise that resolves when the Mongoose connection is 'open'
//         const dbConnectPromise = new Promise<void>((resolve, reject) => {
//             connection.once('open', () => {
//                 console.log('Mongoose connection established successfully.');
//                 resolve();
//             });
//             connection.once('error', (err) => {
//                 console.error('Mongoose connection error during wait:', err);
//                 reject(err);
//             });
//         });

//         await dbConnectPromise; // Wait for the connection to be ready before proceeding

//         // --- Execute deletion logic ---
//         const result = await deleteInspectionByEmails(emailsToPurge);
//         console.log('\n--- PURGE COMPLETE ---');
//         console.log('Summary:', result);

//     } catch (error) {
//         console.error('\n--- PURGE FAILED ---');
//         console.error('Error details:', error);
//         process.exit(1); // Exit with an error code
//     } finally {
//         // --- Disconnect from DB ---
//         // Check if connection is open (1 means connected, 0 means disconnected, 2 connecting, 3 disconnecting)
//         if (connection.readyState === 1) {
//             try {
//                 console.log('Closing Mongoose connection...');
//                 await connection.close();
//                 console.log('Mongoose connection closed.');
//             } catch (closeErr) {
//                 console.error('Error closing Mongoose connection:', closeErr);
//             }
//         } else {
//             console.log('Mongoose connection not open, no need to close.');
//         }
//     }
// })();