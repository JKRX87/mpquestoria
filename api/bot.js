import { Bot, webhookCallback } from "grammy";
import { createClient } from "@supabase/supabase-js";

const bot = new Bot(process.env.BOT_TOKEN);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// /start или /start ref_123
bot.command("start", async (ctx) => {
  const payload = ctx.match; // то, что после /start
  let referrerId = null;

  if (payload && payload.startsWith("ref_")) {
    referrerId = Number(payload.replace("ref_", ""));
  }

  // сохраняем referrer во временные данные telegram
  if (referrerId) {
    await ctx.reply(
      "👋 Ты пришёл по приглашению друга!\nДобро пожаловать в MP Questoria 🚀"
    );
  } else {
    await ctx.reply(
      "🚀 Добро пожаловать в MP Questoria!\n\nНажми кнопку ниже, чтобы начать игру."
    );
  }

  await ctx.reply(
    "🎮 Открыть игру",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎮 Открыть игру",
              web_app: {
                url: `https://mpquestoria.vercel.app/webapp/?referrer=${referrerId ?? ""}`
              }
            }
          ]
        ]
      }
    }
  );
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    const cb = webhookCallback(bot, "http");
    return cb(req, res);
  }
  res.status(200).send("OK");
}
