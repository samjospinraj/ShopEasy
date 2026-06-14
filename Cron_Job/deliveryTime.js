const cron = require("node-cron");
const { Product } = require("../Model/Admin/productModel");
const Order = require("../Model/User/orderModel");
const { model } = require("mongoose");

const deliveryTime_cron = cron.schedule("0 0 * * *", async () => {
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

const productQuantityCron = cron.schedule("*/5 * * * *", async () => {
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

module.exports = { deliveryTime_cron ,  productQuantityCron  }