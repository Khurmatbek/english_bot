require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
const SECRET_CHANNEL_ID = process.env.SECRET_CHANNEL_ID;

// Foydalanuvchi holati
const userState = {};
// Telefon raqamlar
const userContacts = {};

// /start komandasi
bot.start((ctx) => {
  userState[ctx.from.id] = { step: "phone" };
  ctx.reply(
    "Salom! Avval telefon raqamingizni yuboring 👇",
    Markup.keyboard([
      [Markup.button.contactRequest("📞 Telefon raqamni yuborish")]
    ])
      .resize()
      .oneTime()
  );
});

// Telefon raqam qabul qilish
bot.on("contact", (ctx) => {
  userContacts[ctx.from.id] = ctx.message.contact.phone_number;
  userState[ctx.from.id] = { step: "fullname" };
  ctx.reply("✅ Telefon raqamingiz qabul qilindi.\nEndi ismingiz va familiyangizni yozing:");
});

// Ism familiya va mavzu qabul qilish
bot.on("text", (ctx) => {
  const state = userState[ctx.from.id];
  if (!state) return;

  if (state.step === "fullname") {
    userState[ctx.from.id] = { step: "topic", fullname: ctx.message.text };
    return ctx.reply("✅ Qabul qilindi.\nEndi videoning mavzusini yozing:");
  }

  if (state.step === "topic") {
    userState[ctx.from.id] = {
      step: "media",
      fullname: state.fullname,
      topic: ctx.message.text,
    };
    return ctx.reply("✅ Mavzu qabul qilindi.\nEndi video yoki rasm yuboring:");
  }
});

// Media (video yoki rasm) qabul qilish
async function handleMedia(ctx, fileId, type) {
  const state = userState[ctx.from.id];
  if (!state || state.step !== "media") {
    return ctx.reply("❌ Avval /start bosib ketma-ketlikni bajaring.");
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

  try {
    if (type === "video") {
      await ctx.telegram.sendVideo(SECRET_CHANNEL_ID, fileId, { caption });
    } else if (type === "rasm") {
      await ctx.telegram.sendPhoto(SECRET_CHANNEL_ID, fileId, { caption });
    }

    await ctx.reply("✅ Materialingiz qabul qilindi va kanalga yuborildi. Rahmat!");
    userState[ctx.from.id] = null; // reset
  } catch (err) {
    console.error("❌ Yuborishda xatolik:", err);
    await ctx.reply("❌ Xatolik yuz berdi. Keyinroq urinib ko‘ring.");
  }
}

// Video qabul qilish
bot.on("video", (ctx) => {
  handleMedia(ctx, ctx.message.video.file_id, "video");
});

// Rasm qabul qilish
bot.on("photo", (ctx) => {
  // eng katta sifatdagi rasmini olish
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  handleMedia(ctx, photo.file_id, "rasm");
});

bot.launch();
console.log("🤖 Bot ishga tushdi...");
