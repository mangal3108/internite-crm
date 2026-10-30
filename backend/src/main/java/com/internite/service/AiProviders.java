package com.internite.service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * AI providers reachable through the OpenAI-compatible Chat Completions API.
 * The "openai" integration stores a provider id; its base URL and default model come from here
 * unless the integration sets its own baseUrl / model.
 */
public final class AiProviders {

    public record Preset(String label, String baseUrl, String defaultModel, boolean keyOptional) {}

    private static final Map<String, Preset> PRESETS = new LinkedHashMap<>();

    static {
        PRESETS.put("openai", new Preset("OpenAI", "https://api.openai.com/v1", "gpt-4o-mini", false));
        PRESETS.put("anthropic", new Preset("Anthropic Claude", "https://api.anthropic.com/v1", "claude-haiku-5-5", false));
        PRESETS.put("gemini", new Preset("Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.5-flash", false));
        PRESETS.put("mistral", new Preset("Mistral AI", "https://api.mistral.ai/v1", "mistral-small-latest", false));
        PRESETS.put("xai", new Preset("xAI Grok", "https://api.x.ai/v1", "grok-3-mini", false));
        PRESETS.put("groq", new Preset("Groq", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", false));
        PRESETS.put("deepseek", new Preset("DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat", false));
        PRESETS.put("openrouter", new Preset("OpenRouter", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini", false));
        PRESETS.put("together", new Preset("Together AI", "https://api.together.xyz/v1", "meta-llama/Llama-3.3-70B-Instruct-Turbo", false));
        PRESETS.put("perplexity", new Preset("Perplexity", "https://api.perplexity.ai", "sonar", false));
        PRESETS.put("ollama", new Preset("Ollama (self-hosted)", "http://localhost:11434/v1", "llama3.1", true));
        PRESETS.put("custom", new Preset("Custom (OpenAI-compatible)", "", "", true));
    }

    private AiProviders() {}

    /** Normalised provider id; blank or unknown values fall back to "openai". */
    public static String providerId(String raw) {
        String id = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return PRESETS.containsKey(id) ? id : "openai";
    }

    public static Preset preset(String provider) {
        return PRESETS.get(providerId(provider));
    }

    /** Chat Completions URL: the configured base URL wins over the provider preset. */
    public static String chatCompletionsUrl(String provider, String configuredBaseUrl) {
        String base = configuredBaseUrl == null || configuredBaseUrl.isBlank()
            ? preset(provider).baseUrl()
            : configuredBaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (base.isBlank()) {
            throw new IllegalStateException("Set the API Base URL for the custom AI provider.");
        }
        return base.endsWith("/chat/completions") ? base : base + "/chat/completions";
    }

    /** Config problem for the "openai" integration values, or null when they are usable. */
    public static String validationError(Map<String, String> values) {
        String provider = providerId(values.get("provider"));
        Preset preset = PRESETS.get(provider);
        if (!preset.keyOptional() && blank(values.get("apiKey"))) {
            return "Enter the " + preset.label() + " API key.";
        }
        if ("custom".equals(provider) && blank(values.get("baseUrl"))) {
            return "Enter the API Base URL for the custom provider.";
        }
        if ("custom".equals(provider) && blank(values.get("model"))) {
            return "Enter the model name for the custom provider.";
        }
        return null;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
