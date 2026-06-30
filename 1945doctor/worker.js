// --- 1. 全局配置和 CORS 標頭 ---

// CORS 標頭，允許所有來源進行跨域存取
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    // 關鍵修正: Admin API 現在需要支援 GET 請求來讀取提示詞
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", 
    "Access-Control-Allow-Headers": "Content-Type", 
};


// --- 2. CORS 預檢處理函數 ---

/**
 * 處理 OPTIONS 請求（瀏覽器的 CORS 預檢）
 * @param {Request} request 
 * @returns {Response}
 */
function handleOptions(request) {
    // 檢查是否是有效的預檢請求
    if (request.headers.get("Origin") !== null &&
        request.headers.get("Access-Control-Request-Method") !== null
    ) {
        // 返回 204 No Content 狀態碼，並附帶所有 CORS 標頭
        return new Response(null, {
            headers: corsHeaders,
            status: 204 // 關鍵：204 No Content
        });
    } else {
        // 如果不是有效的 CORS 預檢，返回 405 Method Not Allowed
        return new Response(null, {
            headers: {
                "Allow": "GET, POST, OPTIONS"
            },
            status: 405
        });
    }
}


// --- 3. 聊天處理函數 (/api/chat/[personaId]) ---

/**
 * 處理實際的聊天請求，呼叫 Workers AI
 * @param {Request} request 
 * @param {Env} env 
 * @returns {Response}
 */
async function handleChatRequest(request, env) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    // 確保這裡的變量名 (env.AI) 與 Cloudflare 儀表板中的 Workers AI 綁定名稱一致
    const AI_BINDING = env.AI; 
    // 設定 Workers AI 模型的預設名稱
    const DEFAULT_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

    try {
        // =============================================================
        // 步驟 1: URL 解析與人物 ID 提取
        // =============================================================
        const url = new URL(request.url);
        // pathSegments = ['api', 'chat', 'doctor_lin']
        const pathSegments = url.pathname.split('/').filter(s => s); 
        
        // 檢查路徑是否符合 /api/chat/[personaId] 格式 (長度必須是 3)
        if (pathSegments.length !== 3 || pathSegments[0] !== 'api' || pathSegments[1] !== 'chat') {
            console.error("Chat API Endpoint Error: Invalid format.", url.pathname);
            return new Response(JSON.stringify({ 
                error: "Invalid Chat Endpoint Format. Must use /api/chat/[personaId]",
                details: "請檢查前端傳入的 URL 路徑是否包含人物 ID (Persona ID)."
            }), { 
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
        
        // 提取人物 ID (即陣列的第三個元素，索引 [2])
        const personaId = pathSegments[2]; 
        const PROMPT_KV_KEY = personaId; // 將人物 ID 作為 KV 的鍵

        // =============================================================
        // 步驟 2: 處理請求主體、提取 messages 和動態 modelName
        // =============================================================
        // *** 核心修改點：從請求中提取 messages 和 modelName (如果存在) ***
        const { messages = [], modelName: dynamicModelName } = await request.json();

        // 決定要使用的模型名稱 (如果前端未提供，則使用預設值)
        const modelToUse = dynamicModelName || DEFAULT_MODEL;

        // 從 KV 讀取系統提示詞 (Key 現在是動態的 personaId)
        const systemPrompt = await env.History_AI_CONFIG.get(PROMPT_KV_KEY);

        // *** 強化檢查：如果 KV 讀取到的提示詞無效，直接報錯 ***
        if (!systemPrompt || systemPrompt.trim() === "") {
             console.error(`KV Read Error: Prompt for "${personaId}" is missing or empty.`);
             return new Response(JSON.stringify({ 
                 error: "System prompt not loaded from KV.",
                 details: `人物 ID: ${personaId} 在 KV 中找不到或提示詞為空。請確認 KV Key 名稱與 URL 相符。`
             }), { 
                 status: 501, 
                 headers: { ...corsHeaders, "Content-Type": "application/json" } 
             });
        }

        // 3. 將系統提示詞插入到消息列表的開頭
        messages.unshift({ role: "system", content: systemPrompt });

        // 4. 呼叫 Workers AI
        
        console.log(`Attempting AI run for persona: ${personaId}. Model: ${modelToUse}. Messages count: ${messages.length}`);
        
        // *** 核心修改點：使用動態或預設的模型名稱 modelToUse ***
        const response = await AI_BINDING.run(
            modelToUse,
            { messages }
        );

        const assistantResponse = response.response;

        // 5. 返回結果
        return new Response(JSON.stringify({ response: assistantResponse }), {
            headers: { 
                ...corsHeaders, 
                "Content-Type": "application/json" 
            },
            status: 200
        });

    } catch (e) {
        console.error("Chat Request AI Execution Failed:", e.stack || e.message);
        
        return new Response(
            JSON.stringify({ 
                error: "Internal Server Error during AI execution", 
                details: e.message 
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
}


// --- 4. 管理處理函數 (/api/admin/prompt/[personaId]) ---

/**
 * 處理提示詞調校 (Admin) 請求，動態設定特定人物的提示詞
 * 修正：此函數現在同時處理 GET (讀取) 和 POST (寫入)
 * @param {Request} request 
 * @param {Env} env 
 * @returns {Response}
 */
async function handleAdminRequest(request, env) {
    const KV_BINDING = env.History_AI_CONFIG; 

    try {
        // =============================================================
        // 1. 解析 Admin URL 以提取人物 ID
        // =============================================================
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/').filter(s => s); 
        
        // 檢查路徑是否符合 /api/admin/prompt/[personaId] 格式 (長度必須是 4)
        if (pathSegments.length !== 4 || pathSegments[0] !== 'api' || pathSegments[1] !== 'admin' || pathSegments[2] !== 'prompt') {
            return new Response(JSON.stringify({ 
                error: "Invalid Admin Endpoint Format.",
                details: "必須使用 /api/admin/prompt/[personaId] 格式。"
            }), { 
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // 提取人物 ID (即陣列的第四個元素，索引 [3])
        const personaId = pathSegments[3]; 

        // =============================================================
        // 2. 處理 GET 請求 (讀取提示詞)
        // =============================================================
        if (request.method === "GET") {
            const systemPrompt = await KV_BINDING.get(personaId);

            if (systemPrompt === null) {
                 return new Response(JSON.stringify({ 
                    error: "KV Key Not Found",
                    details: `KV Key "${personaId}" 不存在。`
                 }), {
                    status: 404, // 返回 404 告知 KV 中沒有這個 Key
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                 });
            }

            // 成功讀取時，返回 prompt 內容
            return new Response(JSON.stringify({ 
                success: true, 
                prompt: systemPrompt 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }
        
        // =============================================================
        // 3. 處理 POST 請求 (寫入/更新提示詞)
        // =============================================================
        if (request.method === "POST") {
            const { newPrompt } = await request.json();

            if (!newPrompt || typeof newPrompt !== 'string') {
                return new Response(JSON.stringify({ error: "Missing 'newPrompt' in request." }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // 使用動態的 personaId 作為 KV Key
            await KV_BINDING.put(personaId, newPrompt);

            return new Response(JSON.stringify({ 
                success: true, 
                message: `System prompt updated for key: ${personaId}` 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }
        
        // 處理非 GET/POST 的其他方法
        return new Response("Method Not Allowed. Only GET and POST are supported for /api/admin/prompt/.", { 
            status: 405, 
            headers: corsHeaders 
        });

    } catch (e) {
        console.error("Admin Request Error:", e);
        // 如果是 JSON 解析錯誤，會在此處捕獲
        return new Response(
            JSON.stringify({ error: "Server Processing Failed", details: e.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
}


// --- 5. Worker 入口點 (Export Default) ---

// 使用 ES Module 格式匯出 fetch 處理器
export default {
    async fetch(request, env) {
        
        // 1. 如果是 OPTIONS 請求 (CORS 預檢)，直接呼叫 handleOptions
        if (request.method === "OPTIONS") {
            return handleOptions(request);
        }
        
        const url = new URL(request.url);

        // 2. 處理 Admin API 請求 (現在支援 /api/admin/prompt/[personaId] 的 GET/POST)
        if (url.pathname.startsWith("/api/admin/prompt/")) {
            return handleAdminRequest(request, env);
        }
        
        // 3. 處理 Chat API 請求 (現在支援 /api/chat/[personaId])
        // 只有 POST 請求才會進入 handleChatRequest
        if (url.pathname.startsWith("/api/chat/") && request.method === "POST") {
            return handleChatRequest(request, env);
        }
        
        // 4. 處理其他非匹配路徑
        return new Response("Not Found. Please check the URL path (e.g., /api/chat/persona_name).", {
            status: 404,
            headers: corsHeaders // 確保 404 也帶上 CORS 標頭
        });
    }
};
