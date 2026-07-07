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
const resultBox = document.querySelector("#resultBox");

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

function updateResult(level, matches) {
  const reasons = buildReasons(level, matches);

  resultBox.className = `result-box ${level.toLowerCase()}`;
  resultBox.innerHTML = `
    <strong>Scam Risk: ${level}</strong>
    <div class="result-detail">
      <h4>Why:</h4>
      <ul>
        ${reasons.map((reason) => `<li>${reason}</li>`).join("")}
      </ul>
      <h4>What you should do:</h4>
      <ul>
        <li>Do not click suspicious links.</li>
        <li>Do not share OTP, password, NRIC, Singpass, or bank details.</li>
        <li>Contact the organisation through official channels.</li>
      </ul>
    </div>
  `;
}

if (checkButton && messageInput && resultBox) {
  checkButton.addEventListener("click", () => {
    const message = messageInput.value.trim().toLowerCase();

    if (!message) {
      resultBox.className = "result-box";
      resultBox.innerHTML = "<strong>Scam Risk:</strong><span>Please paste a message first.</span>";
      return;
    }

    const highMatches = getMatchedKeywords(message, highRiskKeywords);
    const mediumMatches = getMatchedKeywords(message, mediumRiskKeywords);

    if (highMatches.length > 0) {
      updateResult("High", highMatches);
      return;
    }

    if (mediumMatches.length > 0) {
      updateResult("Medium", mediumMatches);
      return;
    }

    updateResult("Low", []);
  });
}
