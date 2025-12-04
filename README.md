<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>1945·沉默的聽診器</title>
    <!-- 載入 Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', 'Microsoft JhengHei', sans-serif; background-color: #f0f4f8; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <div class="max-w-xl w-full bg-white p-8 rounded-xl shadow-2xl">
        <h1 class="text-3xl font-bold text-center text-gray-800 mb-6 border-b pb-4">
            AI 歷史人物專案
        </h1>
        <p class="text-center text-gray-600 mb-8">
            請選擇您的身份以繼續：
        </p>

        <div class="flex flex-col md:flex-row gap-6">
            <!-- 封測人員 (導向 siteA.html) -->
            <a href="siteA.html" class="flex-1">
                <div class="bg-indigo-500 hover:bg-indigo-600 transition duration-300 p-6 rounded-lg shadow-lg text-white text-center cursor-pointer transform hover:scale-[1.02] active:scale-100">
                    <div class="text-4xl mb-3">🛠️</div>
                    <h2 class="text-xl font-semibold mb-1">封測人員 / 調校者</h2>
                    <p class="text-sm opacity-90">專屬介面，可調整 AI 人物的人設提示詞。</p>
                </div>
            </a>

            <!-- 公開實驗 (導向 siteB.html) -->
            <a href="siteB.html" class="flex-1">
                <div class="bg-teal-500 hover:bg-teal-600 transition duration-300 p-6 rounded-lg shadow-lg text-white text-center cursor-pointer transform hover:scale-[1.02] active:scale-100">
                    <div class="text-4xl mb-3">💬</div>
                    <h2 class="text-xl font-semibold mb-1">公開實驗 / 一般使用者</h2>
                    <p class="text-sm opacity-90">單純與 AI 人物進行對話與互動。</p>
                </div>
            </a>
        </div>
        
        <p class="text-center text-xs text-gray-400 mt-8">
            專案版本 1.0.0
        </p>
    </div>
</body>
</html>
