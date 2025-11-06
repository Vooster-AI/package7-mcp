import { describe, it } from "vitest";

import { SearchMode } from "../../constants/search-mode.js";
import { createDocsRepository } from "../createDocsRepository.js";

// These are E2E tests that require real network access
// They test the actual TossPayments documentation
describe("docs", () => {
  const TOSSPAYMENTS_ID = "tosspayments";
  const TOSSPAYMENTS_URL = "https://docs.tosspayments.com/llms.txt";

  it("retrieves keywords from v1 documents", async () => {
    const repository = await createDocsRepository(TOSSPAYMENTS_ID, TOSSPAYMENTS_URL);
    const keywords = repository.getAllV1Keywords();

    console.log(JSON.stringify(keywords));
  });

  it("retrieves keywords from v2 documents", async () => {
    const repository = await createDocsRepository(TOSSPAYMENTS_ID, TOSSPAYMENTS_URL);
    const keywords = repository.getAllV2Keywords();

    console.log(JSON.stringify(keywords));
  });

  it("retrieves v1 documents correctly", async () => {
    const repository = await createDocsRepository(TOSSPAYMENTS_ID, TOSSPAYMENTS_URL);
    const text = await repository.findV1DocumentsByKeyword(
      ["결제위젯", "연동"],
      SearchMode.BALANCED,
      25000
    );

    console.log("V1 Search results:");
    console.log(text);
  });

  it("retrieves v2 documents correctly", async () => {
    const repository = await createDocsRepository(TOSSPAYMENTS_ID, TOSSPAYMENTS_URL);
    const text = await repository.findV2DocumentsByKeyword(
      ["JavaScript", "SDK", "토스페이먼츠", "초기화", "결제위젯"],
      // ["결제위젯", "위젯", "메서드"],
      SearchMode.BALANCED,
      25000
    );

    console.log("V2 Search results:");
    console.log(text);
  });

  it("pagination works correctly with offset and limit", async () => {
    const repository = await createDocsRepository(TOSSPAYMENTS_ID, TOSSPAYMENTS_URL);

    // First page
    const firstPage = await repository.findV2DocumentsByKeyword(
      ["결제"],
      SearchMode.BALANCED,
      25000
    );

    // Second page
    const secondPage = await repository.findV2DocumentsByKeyword(
      ["결제"],
      SearchMode.BALANCED,
      25000
    );

    console.log("First page (0-2):");
    console.log(firstPage);
    console.log("\nSecond page (3-5):");
    console.log(secondPage);
  });

  it("results differ with various searchMode options", async () => {
    const repository = await createDocsRepository(TOSSPAYMENTS_ID, TOSSPAYMENTS_URL);
    const keywords = ["가상계좌", "발급"];

    const broadResults = await repository.findV2DocumentsByKeyword(
      keywords,
      SearchMode.BROAD,
      25000
    );

    const balancedResults = await repository.findV2DocumentsByKeyword(
      keywords,
      SearchMode.BALANCED,
      25000
    );

    const preciseResults = await repository.findV2DocumentsByKeyword(
      keywords,
      SearchMode.PRECISE,
      25000
    );

    console.log("BROAD mode results:");
    console.log(broadResults);
    console.log("\nBALANCED mode results:");
    console.log(balancedResults);
    console.log("\nPRECISE mode results:");
    console.log(preciseResults);
  });
});
