const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

document.querySelectorAll("img[data-fallback]").forEach((image) => {
  const hideBrokenImage = () => {
    const directFallback = image.nextElementSibling;
    const wrapperFallback = image.parentElement ? image.parentElement.nextElementSibling : null;
    const fallback = directFallback || wrapperFallback;

    image.hidden = true;
    if (image.parentElement && image.parentElement.classList.contains("screenshot-frame")) {
      image.parentElement.hidden = true;
    }
    if (fallback && fallback.classList.contains("image-fallback")) {
      fallback.classList.add("show");
    }
    if (fallback && fallback.classList.contains("brand-fallback")) {
      fallback.classList.add("show");
    }
  };

  image.addEventListener("error", hideBrokenImage);

  if (image.complete && image.naturalWidth === 0) {
    hideBrokenImage();
  }
});

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const currentPage = window.location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".nav-links a").forEach((link) => {
  const linkPage = link.getAttribute("href");

  if (linkPage === currentPage) {
    link.classList.add("active");
  }
});

const checkButton = document.querySelector("#checkButton");
const messageInput = document.querySelector("#messageInput");
const chatMessages = document.querySelector("#chatMessages");
const N8N_TIMEOUT_MS = 45000;

const highRiskKeywords = [
  "otp",
  "password",
  "nric",
  "singpass",
  "suspended",
  "verify",
  "urgent",
  "bank",
  "click",
  "http",
  "https",
  "login",
  "disabled",
  "account closure"
];

const mediumRiskKeywords = [
  "prize",
  "reward",
  "delivery",
  "parcel",
  "account",
  "limited time",
  "winner",
  "claim",
  "transfer"
];

function getMatchedKeywords(message, keywords) {
  return keywords.filter((keyword) => message.includes(keyword));
}

function buildReasons(level, matches) {
  if (level === "Low") {
    return [
      "No major scam keywords were found in this simple demo.",
      "The message may still be unsafe if the sender, link, or request feels unusual."
    ];
  }

  const reasons = matches.slice(0, 3).map((keyword) => {
    return `Detected the warning keyword "${keyword}".`;
  });

  if (level === "High") {
    reasons.push("High-risk messages often ask for urgent action, login details, OTPs, or link clicks.");
  }

  if (level === "Medium") {
    reasons.push("Medium-risk messages often mention rewards, parcels, claims, transfers, or account issues.");
  }

  return reasons.slice(0, 3);
}

function normaliseRiskClass(level) {
  const riskLevel = String(level || "").toLowerCase();

  if (riskLevel.includes("high")) {
    return "high";
  }

  if (riskLevel.includes("medium")) {
    return "medium";
  }

  if (riskLevel.includes("low")) {
    return "low";
  }

  return "";
}

function appendTextWithLineBreaks(parent, text) {
  String(text).split(/\r?\n/).forEach((line, index) => {
    if (index > 0) {
      parent.appendChild(document.createElement("br"));
    }

    parent.appendChild(document.createTextNode(line));
  });
}

function buildLocalRuleResponse(level, matches) {
  const reasons = buildReasons(level, matches);

  return [
    `Scam Risk: ${level}`,
    "",
    "Why:",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "What you should do:",
    "- Do not click suspicious links.",
    "- Do not share OTP, password, NRIC, Singpass, or bank details.",
    "- Contact the organisation through official channels."
  ].join("\n");
}

function scrollChatToLatest() {
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function createChatBubble(sender, message, riskLevel = "") {
  if (!chatMessages) {
    return null;
  }

  const bubble = document.createElement("div");
  const riskClass = sender === "bot" ? normaliseRiskClass(riskLevel) : "";
  bubble.className = ["chat-message", sender, riskClass].filter(Boolean).join(" ");

  const messageText = document.createElement("div");
  messageText.className = "chat-message-text";
  appendTextWithLineBreaks(messageText, message);

  bubble.appendChild(messageText);
  chatMessages.appendChild(bubble);
  scrollChatToLatest();

  return bubble;
}

function replaceBubbleMessage(bubble, message, riskLevel = "") {
  if (!bubble) {
    return;
  }

  const riskClass = normaliseRiskClass(riskLevel);
  bubble.className = ["chat-message", "bot", riskClass].filter(Boolean).join(" ");
  bubble.textContent = "";

  const messageText = document.createElement("div");
  messageText.className = "chat-message-text";
  appendTextWithLineBreaks(messageText, message);

  bubble.appendChild(messageText);
  scrollChatToLatest();
}

function runLocalRuleChecker(userMessage) {
  const message = userMessage.trim().toLowerCase();
  const highMatches = getMatchedKeywords(message, highRiskKeywords);
  const mediumMatches = getMatchedKeywords(message, mediumRiskKeywords);

  if (highMatches.length > 0) {
    return {
      risk: "High",
      reply: buildLocalRuleResponse("High", highMatches)
    };
  }

  if (mediumMatches.length > 0) {
    return {
      risk: "Medium",
      reply: buildLocalRuleResponse("Medium", mediumMatches)
    };
  }

  return {
    risk: "Low",
    reply: buildLocalRuleResponse("Low", [])
  };
}

async function checkWithN8n(userMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetch("https://n8ngc.codeblazar.org/webhook/kopicheck-web-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: userMessage
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Webhook returned HTTP ${response.status}`);
    }

    const responseText = await response.text();

    if (!responseText.trim()) {
      throw new Error("n8n returned an empty response");
    }

    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error("Raw n8n response:", responseText);
      throw new Error("n8n returned invalid JSON");
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

function getObjectValue(data) {
  if (Array.isArray(data)) {
    return data[0];
  }

  return data;
}

function getN8nResult(data) {
  const root = getObjectValue(data);

  if (!root || typeof root !== "object") {
    throw new Error("KopiCheck AI checker returned an empty response");
  }

  const output = root.output && typeof root.output === "object" ? getObjectValue(root.output) : {};
  const nestedOutput = output.output && typeof output.output === "object" ? getObjectValue(output.output) : {};
  const risk = root.riskLevel || root.risk || output.risk || nestedOutput.risk || "";
  const reply = root.reply || output.reply || nestedOutput.reply;

  if (!reply || typeof reply !== "string") {
    throw new Error("KopiCheck AI checker response is missing a reply");
  }

  return { risk, reply };
}

function replyAlreadyIncludesRisk(reply) {
  return /scam\s+risk\s*:/i.test(reply) || /^risk\s*:/im.test(reply);
}

function buildN8nReplyText(data) {
  const { risk, reply } = getN8nResult(data);
  const shouldAddRisk = risk && !replyAlreadyIncludesRisk(reply);

  return {
    risk,
    reply: shouldAddRisk ? `Scam Risk: ${risk}\n\n${reply}` : reply
  };
}

function getFallbackNotice(error) {
  if (error && error.name === "AbortError") {
    return "KopiCheck took too long to respond. Showing a simple website estimate instead.";
  }

  return "AI checker is temporarily unavailable. Showing a simple website estimate instead.";
}

async function sendChatMessage() {
  if (!checkButton || !messageInput || !chatMessages || checkButton.disabled) {
    return;
  }

  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  createChatBubble("user", message);
  messageInput.value = "";
  checkButton.disabled = true;

  const loadingBubble = createChatBubble("bot", "KopiCheck is checking your message...");

  try {
    const n8nData = await checkWithN8n(message);
    const n8nResult = buildN8nReplyText(n8nData);
    replaceBubbleMessage(loadingBubble, n8nResult.reply, n8nResult.risk);
  } catch (error) {
    console.error(error);
    const fallbackResult = runLocalRuleChecker(message);
    replaceBubbleMessage(
      loadingBubble,
      `${getFallbackNotice(error)}\n\n${fallbackResult.reply}`,
      fallbackResult.risk
    );
  } finally {
    checkButton.disabled = false;
    messageInput.focus();
  }
}

if (checkButton && messageInput && chatMessages) {
  createChatBubble(
    "bot",
    "\u2615 Hello! I\u2019m KopiCheck. Paste a suspicious SMS, WhatsApp message, email, or link below, and I\u2019ll help you check it."
  );

  checkButton.addEventListener("click", sendChatMessage);

  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
}
