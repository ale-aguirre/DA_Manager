
// Mock of the planner logic for testing
function normalizeTag(tag) {
    let clean = tag.replace(/[(){}[\]]/g, "");
    if (clean.includes(":")) {
        clean = clean.split(":")[0];
    }
    return clean.replace(/_/g, " ").trim().toLowerCase();
}

function isMatch(token, target) {
    if (!target) return false;
    const tokenNorm = normalizeTag(token);
    const targetNorm = normalizeTag(target);
    if (tokenNorm === targetNorm) return true;
    return tokenNorm.includes(targetNorm) || targetNorm.includes(tokenNorm);
}

// Test Suite
const tests = [
    { token: "(red_dress:1.3)", target: "red dress", expected: true },
    { token: "red dress", target: "red_dress", expected: true },
    { token: "dark red dress", target: "dress", expected: true },
    { token: "dress", target: "red dress", expected: true }, // Aggressive removal
    { token: "(nsfw:1.2)", target: "nsfw", expected: true },
    { token: "my_tag", target: "other_tag", expected: false },
    { token: "sitting", target: "sitting on chair", expected: true },
];

let failed = 0;
tests.forEach(t => {
    const res = isMatch(t.token, t.target);
    if (res !== t.expected) {
        console.error(`FAIL: ${t.token} vs ${t.target}. Expected ${t.expected}, got ${res}`);
        failed++;
    } else {
        console.log(`PASS: ${t.token} vs ${t.target}`);
    }
});

// Test filter logic
let tokens = ["(nsfw:1.2)", "masterpiece", "red_dress", "blue_sky"];
const toRemove = ["nsfw", "red dress"];

tokens = tokens.filter(t => !toRemove.some(r => isMatch(t, r)));
console.log("Filtered Tokens:", tokens);

if (tokens.length !== 2 || tokens.includes("(nsfw:1.2)") || tokens.includes("red_dress")) {
    console.error("FAIL: Filtering did not remove expected tokens.");
    failed++;
} else {
    console.log("PASS: Filtering works.");
}

if (failed > 0) process.exit(1);
console.log("ALL TESTS PASSED");
