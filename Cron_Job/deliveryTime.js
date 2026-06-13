const cron = require("node-cron");
const { Product } = require("../Model/Admin/productModel");
const Order = require("../Model/User/orderModel");

const deliveryTime_cron = cron.schedule("0 0 0 * * *", async () => {
  try {
    const products = await Product.find();

    for (const product of products) {
      const now = Date.now();

      const minDays = product.delivery?.minDays ?? 1;
      const maxDays = product.delivery?.maxDays ?? 4;

      product.deliveryTimeline = {
        minTime: new Date(now + minDays * 24 * 60 * 60 * 1000),
        maxTime: new Date(now + maxDays * 24 * 60 * 60 * 1000),
      };

      await product.save();
      console.log(`Updated delivery timeline for product ${product}`);
    }

    console.log("Delivery timelines updated");
    console.log(products.map(p => ({ id: p._id, deliveryTimeline: p.deliveryTimeline })));
  } catch (err) {
    console.error(err);
  }
});

const productQuantityCron = cron.schedule("*/5 * * * * *", async () => {
  try {

    const orders = await Order.find();

    for (const order of orders) {

      let targetAction = null;

      // 1. Confirmed => Reduce stock
      if (
        order.orderStatus === "confirmed" &&
        order.inventoryAction !== "confirmed"
      ) {
        targetAction = "confirmed";
      }

      // 2. Cancelled after confirmation => Restore stock
      else if (
        order.orderStatus === "cancelled" &&
        order.inventoryAction !== "cancelled"
      ) {
        targetAction = "cancelled";
      }

      // 3. Return approved => Restore stock
      else if (
        order.orderStatus === "returned" &&
        order.returnStatus === "approved" &&
        order.inventoryAction !== "returned"
      ) {
        targetAction = "returned";
      } 

      if (!targetAction) continue;

      for (const item of order.items) {

        let stockChange = 0;

        switch (targetAction) {

          case "confirmed":
            stockChange = -item.quantity;
            break;

          case "cancelled":
            stockChange = item.quantity;
            break;

          case "returned":
            stockChange = item.quantity;
            break;

          default:
            continue;
        }

        await Product.updateOne(
          { _id: item.productId },
          {
            $inc: {
              stockQuantity: stockChange
            }
          }
        );

        console.log(
          `Order: ${order._id} | Product: ${item.productId} | Stock Change: ${stockChange}`
        );
      }

      order.inventoryAction = targetAction;
      await order.save();

      console.log(
        `Order ${order._id} inventoryAction updated to ${targetAction}`
      );
    }

  } catch (error) {
    console.error("Cron Error:", error);
  }
});

// const productQuantityCron = cron.schedule("*/5 * * * * *", async () => {
//   try {
//     const orders = await Order.find({
//       stockProcessed: false,
//     });

//     console.log(`Orders Found: ${orders.length}`);

//     for (const order of orders) {
//       let stockUpdated = false;

//       for (const item of order.items) {
//         let stockChange = 0;

//         // CONFIRMED
//         if (order.orderStatus === "confirmed") {
//           stockChange = -item.quantity;
//         }

//         // CANCELLED
//         else if (order.orderStatus === "cancelled") {
//           stockChange = item.quantity;
//         }

//         // RETURNED
//         else if (order.orderStatus === "returned") {
//           if (
//             order.returnStatus === "approved" ||
//             order.returnStatus === "accepted"
//           ) {
//             stockChange = item.quantity;
//           } else if (order.returnStatus === "rejected") {
//             stockChange = 0;
//           }
//         }

//         if (stockChange === 0) continue;

//         await Product.updateOne(
//           {
//             _id: item.productId,
//           },
//           {
//             $inc: {
//               stockQuantity: stockChange,
//             },
//           }
//         );

//         stockUpdated = true;

//         console.log(
//           `Product ${item.productId} updated by ${stockChange}`
//         );
//       }

//       if (stockUpdated) {
//         await Order.updateOne(
//           { _id: order._id },
//           {
//             $set: {
//               stockProcessed: true,
//             },
//           }
//         );

//         console.log(`Order ${order._id} marked as processed`);
//       }

//     }
//   } catch (error) {
//     console.error("Cron Error:", error);
//   }
// });




// const productQuantityCron = cron.schedule('*/10 * * * * *', async () => {
//   try {
//     while (true) {
//       // 1. Atomically pick ONE unprocessed order and lock it
//       const order = await Order.findOneAndUpdate(
//         {
//           stockUpdated: { $ne: true },
//           'stockFlags.processing': { $ne: true }
//         },
//         {
//           $set: { 'stockFlags.processing': true }
//         },
//         {
//           new: true
//         }
//       ).lean();

//       if (!order) {
//         console.log('No pending orders to process');
//         break;
//       }

//       console.log(`Processing order ${order._id}`);

//       try {
//         // 2. Process items
//         for (const item of order.items) {
//           let incValue = 0;
//           let action = '';

//           if (order.orderStatus === 'confirmed') {
//             incValue = -item.quantity;
//             action = 'reduced';
//           } else if (order.orderStatus === 'cancelled') {
//             incValue = item.quantity;
//             action = 'increased (cancel)';
//           } else if (order.orderStatus === 'returned') {
//             if (order.returnStatus === 'rejected') {
//               incValue = -item.quantity;
//               action = 'reduced (return rejected)';
//             } else {
//               incValue = item.quantity;
//               action = 'increased (return)';
//             }
//           } else if (order.returnStatus === 'rejected') {
//             incValue = -item.quantity;
//             action = 'reduced (return rejected)';
//           } else {
//             console.log(`SKIP product ${item.productId}`);
//             continue;
//           }

//           await Product.updateOne(
//             { _id: item.productId },
//             [
//               {
//                 $set: {
//                   stockQuantity: {
//                     $max: [0, { $add: ['$stockQuantity', incValue] }]
//                   }
//                 }
//               }
//             ]
//           );

//           console.log(
//             `✓ ${action.toUpperCase()} product ${item.productId} by ${Math.abs(incValue)}`
//           );
//         }

//         // 3. Mark order as processed
//         await Order.updateOne(
//           { _id: order._id },
//           {
//             $set: {
//               stockUpdated: true,
//               stockProcessedAt: new Date()
//             },
//             $unset: { 'stockFlags.processing': '' }
//           }
//         );

//         console.log(`✅ Order ${order._id} completed`);
//       } catch (err) {
//         // release lock on failure
//         await Order.updateOne(
//           { _id: order._id },
//           { $unset: { 'stockFlags.processing': '' } }
//         );

//         console.error(`❌ Order failed ${order._id}`, err);
//       }
//     }
//   } catch (err) {
//     console.error('Cron Error:', err);
//   }
// });