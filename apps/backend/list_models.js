const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function run() {
  try {
    const models = await genAI.getModels(); // Oops, SDK might not have getModels? No wait, REST has it.
  } catch (e) {
    console.error(e);
  }
}
run();
