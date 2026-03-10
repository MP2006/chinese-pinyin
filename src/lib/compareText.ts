export interface CharResult {
  expected: string;
  actual: string;
  status: "correct" | "wrong" | "missing" | "extra";
}

export interface CompareResult {
  chars: CharResult[];
  accuracy: number;
}

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

export function stripNonChinese(text: string): string {
  return (text.match(CJK_REGEX) || []).join("");
}

export function compareChineseText(
  expected: string,
  actual: string
): CompareResult {
  const e = stripNonChinese(expected);
  const a = stripNonChinese(actual);

  if (e.length === 0) {
    return {
      chars: [...a].map((ch) => ({ expected: "", actual: ch, status: "extra" })),
      accuracy: 0,
    };
  }

  if (a.length === 0) {
    return {
      chars: [...e].map((ch) => ({
        expected: ch,
        actual: "",
        status: "missing",
      })),
      accuracy: 0,
    };
  }

  // Levenshtein DP with backtrace
  const m = e.length;
  const n = a.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (e[i - 1] === a[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrace to build alignment
  const chars: CharResult[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && e[i - 1] === a[j - 1]) {
      chars.push({ expected: e[i - 1], actual: a[j - 1], status: "correct" });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      // Substitution
      chars.push({ expected: e[i - 1], actual: a[j - 1], status: "wrong" });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      // Deletion from expected (missing in actual)
      chars.push({ expected: e[i - 1], actual: "", status: "missing" });
      i--;
    } else {
      // Insertion in actual (extra)
      chars.push({ expected: "", actual: a[j - 1], status: "extra" });
      j--;
    }
  }

  chars.reverse();

  const correctCount = chars.filter((c) => c.status === "correct").length;
  const accuracy = Math.round((correctCount / m) * 100);

  return { chars, accuracy };
}
