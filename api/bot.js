import { Bot, webhookCallback } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN);

bot.command("start", async (ctx) => {
  await ctx.reply(
    "🚀 Добро пожаловать в MP Questoria!\n\nНажми кнопку ниже, чтобы начать игру.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎮 Открыть игру",
              web_app: {
                url: "https://mpquestoria.vercel.app/webapp/"
              }
            }
          ]
        ]
      }
    }
  );
});

// 👇 ВАЖНО: правильный handler для Vercel
export default async function handler(req, res) {
  if (req.method === "POST") {
    const cb = webhookCallback(bot, "http");
    return cb(req, res);
  }

  res.status(200).send("MP Questoria bot is running 🚀");
}
