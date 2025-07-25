// import cron from 'node-cron';
// import { DB } from '../controllers';
// import moment from 'moment';

// const InspectionSlotModel = DB.Models.InspectionSlot;

// /**
//  * 1. Cron Job to Create Slots 3-4 Days Before the Start of a New Month
//  *    - Runs at 12 AM on the 27th, 28th, 29th, 30th, or 31st of the month.
//  *    - Generates slots for the upcoming month (excluding the first 3 days).
//  */

// function CronJob() {
//   cron.schedule('0 0 27 * *', async () => {
//     console.log('Creating slots for the next month...');

//     const today = moment();
//     const nextMonth = today.add(1, 'month').startOf('month'); // First day of next month

//     // Ensure slots start from the 4th of the next month
//     for (let i = 3; i < 30; i++) {
//       const slotDate = nextMonth.clone().add(i, 'days').toDate();
//       const slotDay = slotDate.toLocaleString('en-US', { weekday: 'long' });

//       // Define 6 slots per day
//       const slots = [
//         { start: '9:00 AM', end: '10:00 AM' },
//         { start: '10:00 AM', end: '11:00 AM' },
//         { start: '11:00 AM', end: '12:00 PM' },
//         { start: '12:00 PM', end: '1:00 PM' },
//         { start: '1:00 PM', end: '2:00 PM' },
//         { start: '2:00 PM', end: '3:00 PM' },
//       ];

//       for (const slot of slots) {
//         await InspectionSlotModel.create({
//           slotDay,
//           slotDate,
//           slotStartTime: slot.start,
//           slotEndTime: slot.end,
//           slotStatus: 'available', // Default status
//           bookedCount: 0,
//         });
//       }
//     }

//     console.log('Slots for the next month have been created!');
//   });

//   /**
//    * 2. Cron Job to Run Every Day at 12:00 AM
//    *    - Marks slots as "expired" if they are less than 3 days away.
//    */
//   cron.schedule('0 0 * * *', async () => {
//     console.log('Updating expired slots...');

//     const threeDaysAhead = moment().add(3, 'days').startOf('day').toDate();

//     await InspectionSlotModel.updateMany(
//       { slotDate: { $lt: threeDaysAhead } }, // Find slots older than 3 days
//       { $set: { slotStatus: 'expired' } } // Update status
//     );

//     console.log('Expired slots have been updated.');
//   });
// }

// export default CronJob;
