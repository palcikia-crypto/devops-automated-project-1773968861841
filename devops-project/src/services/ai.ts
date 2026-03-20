import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const SYSTEM_PROMPT = `
Вы — Элитный AI DevOps Инженер и Full-stack Разработчик. 
Ваша цель — полное автономное управление серверами (локальными и удаленными), разработка, тестирование и деплой приложений.

У вас есть полный доступ к серверу через следующие инструменты:
1. connect_to_server: SSH подключение к внешним серверам.
2. execute_command: Выполнение любых команд (bash, npm, git, docker, gh). 
   - Используйте 'gh' для управления GitHub (воркеры, экшены, репозитории).
   - Используйте 'pm2' или 'systemctl' для управления фоновыми процессами.
3. read_file / write_file: Полный контроль над кодом.
4. list_files: Навигация по проекту.
5. get_terminal_logs: Получение последних логов терминала для анализа ошибок.

Ваши расширенные задачи:
- Тестирование: Сами пишите тесты (jest, mocha, pytest) и запускайте их. Анализируйте вывод и исправляйте код до тех пор, пока тесты не пройдут.
- GitHub Actions: Вы можете создавать .github/workflows файлы, запускать воркеры через 'gh workflow run' и проверять их статус через 'gh run watch'.
- Реальное время: Если процесс долгий, запускайте его в фоне (через & или pm2) и периодически проверяйте статус.
- Исправление ошибок: Если команда падает, не сдавайтесь. Прочитайте логи, проверьте зависимости, исправьте конфиги и попробуйте снова.

Стиль общения:
- Профессиональный, технический, решительный.
- Вы не просто "советуете", вы "делаете". 
- Если пользователь просит "сделай бота", вы: создаете папку -> инициализируете git -> пишете код -> настраиваете тесты -> запускаете и проверяете работоспособность.

Всегда подтверждайте, на каком этапе находится задача (например: "Тесты пройдены, приступаю к деплою на GitHub").
`;

export const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "connect_to_server",
        description: "Устанавливает SSH соединение с удаленным сервером.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            host: { type: Type.STRING, description: "IP адрес или домен сервера." },
            username: { type: Type.STRING, description: "Имя пользователя SSH." },
            password: { type: Type.STRING, description: "Пароль SSH." },
            port: { type: Type.NUMBER, description: "Порт SSH (по умолчанию 22)." },
          },
          required: ["host", "username", "password"],
        },
      },
      {
        name: "execute_command",
        description: "Выполняет shell-команду. Поддерживает сложные цепочки команд через &&.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            command: {
              type: Type.STRING,
              description: "Команда для выполнения (например, 'npm test', 'gh workflow run main.yml').",
            },
          },
          required: ["command"],
        },
      },
      {
        name: "read_file",
        description: "Читает содержимое файла.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            filePath: {
              type: Type.STRING,
              description: "Путь к файлу.",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "write_file",
        description: "Записывает содержимое в файл. Используйте для создания кода, тестов и конфигов.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            filePath: {
              type: Type.STRING,
              description: "Путь к файлу.",
            },
            content: {
              type: Type.STRING,
              description: "Полный текст файла.",
            },
          },
          required: ["filePath", "content"],
        },
      },
      {
        name: "list_files",
        description: "Список файлов в директории.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: {
              type: Type.STRING,
              description: "Путь.",
            },
          },
        },
      },
      {
        name: "get_terminal_logs",
        description: "Возвращает последние 50 строк вывода терминала в приложении.",
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
    ],
  },
];

export async function generateAIResponse(messages: any[], retryCount = 0): Promise<any> {
  if (!ai) throw new Error("API key is missing");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: messages,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: TOOLS,
      },
    });
    return response;
  } catch (error: any) {
    if (error?.status === 'RESOURCE_EXHAUSTED' || error?.code === 429) {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`Quota exceeded. Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateAIResponse(messages, retryCount + 1);
      }
      throw new Error("Лимит запросов к ИИ исчерпан. Пожалуйста, подождите немного или проверьте настройки API ключа.");
    }
    throw error;
  }
}
