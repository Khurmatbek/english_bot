require("dotenv").config();
const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
const SECRET_CHANNEL_ID = process.env.SECRET_CHANNEL_ID;

// === STATE STORAGE ===
const userState = {};
const userContacts = {};

// /start komandasi
bot.start((ctx) => {
  userState[ctx.from.id] = { step: "phone" };
  ctx.reply(
    "Salom! Avval telefon raqamingizni yuboring 👇",
    Markup.keyboard([
      [Markup.button.contactRequest("📞 Telefon raqamni yuborish")]
    ]).resize().oneTime()
  );
});

// Telefon qabul qilish
bot.on("contact", (ctx) => {
  userContacts[ctx.from.id] = ctx.message.contact.phone_number;
  userState[ctx.from.id] = { step: "fullname" };
  ctx.reply("✅ Telefon qabul qilindi.\nEndi ism-familyani yozing:");
});

// Textlarni ketma-ket olish
bot.on("text", (ctx) => {
  const state = userState[ctx.from.id];
  if (!state) return;

  if (state.step === "fullname") {
    userState[ctx.from.id] = { step: "topic", fullname: ctx.message.text };
    return ctx.reply("✅ Qabul qilindi.\nEndi mavzuni yozing:");
  }

  if (state.step === "topic") {
    userState[ctx.from.id] = {
      step: "media",
      fullname: state.fullname,
      topic: ctx.message.text,
    };
    return ctx.reply("✅ Qabul qilindi.\nEndi video, dumaloq video yoki rasm yuboring:");
  }
});

// Universal media handler
async function handleMedia(ctx, fileId, type) {
  const state = userState[ctx.from.id];
  if (!state || state.step !== "media") {
    return ctx.reply("❌ Avval /start bosing.");
  }

  const u = ctx.from;
  const fullname = state.fullname || `${u.first_name || ""} ${u.last_name || ""}`;
  const username = u.username ? `@${u.username}` : "❌ Username yo‘q";
  const phone = userContacts[u.id] || "❌ Telefon raqam yo‘q";
  const topic = state.topic || "Mavzu kiritilmagan";

  const caption = `
🎥 Yangi ${type}

👤 Ism: ${fullname}
📞 Telefon: ${phone}
🔗 Username: ${username}
📝 Mavzu: ${topic}
  `;

  if (type === "video") {
    await ctx.telegram.sendVideo(SECRET_CHANNEL_ID, fileId, { caption });
  } else if (type === "dumaloq video") {
    // Dumaloq video caption qabul qilmaydi, shuning uchun alohida yuboramiz
    await ctx.telegram.sendVideoNote(SECRET_CHANNEL_ID, fileId);
    await ctx.telegram.sendMessage(SECRET_CHANNEL_ID, caption);
  } else if (type === "rasm") {
    await ctx.telegram.sendPhoto(SECRET_CHANNEL_ID, fileId, { caption });
  }

  await ctx.reply("✅ Material qabul qilindi va kanalga yuborildi.");
  userState[ctx.from.id] = null;
}

// === MEDIA HANDLERS ===

// Oddiy video
bot.on("video", (ctx) => handleMedia(ctx, ctx.message.video.file_id, "video"));

// Dumaloq video (video_note)
bot.on("video_note", (ctx) =>
  handleMedia(ctx, ctx.message.video_note.file_id, "dumaloq video")
);

// Rasm
bot.on("photo", (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  handleMedia(ctx, photo.file_id, "rasm");
});

// === EXPRESS SERVER ===
const app = express();
app.use(express.json());
app.use(bot.webhookCallback("/secret-path"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("🚀 Server ishlayapti, port:", PORT);

  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/secret-path`;
  await bot.telegram.setWebhook(webhookUrl, {
    allowed_updates: ["message", "video", "video_note", "photo", "contact", "text"]
  });

  console.log("✅ Webhook ulandi:", webhookUrl);
});
