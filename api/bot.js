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

export default webhookCallback(bot);
