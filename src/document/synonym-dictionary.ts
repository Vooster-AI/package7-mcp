export class SynonymDictionary {
  private readonly dictionary: Record<string, string[]> = {
    // Korean synonyms
    결제취소: ["결제 취소"],
    부분취소: ["부분 취소"],
    환불정책: ["환불", "정책", "규정"],
    결제한도: ["결제", "한도", "제한"],
    결제만료: ["결제", "만료"],
    "결제 만료": ["결제", "만료"],
    가상계좌만료: ["가상계좌", "만료"],
    정산주기: ["정산", "주기", "기간"],
    "정산 주기": ["정산", "주기", "기간"],
    정산지연: ["정산", "지연"],
    "정산 지연": ["정산", "지연"],
    정산오류: ["정산", "오류"],
    "정산 오류": ["정산", "오류"],
    무이자할부: ["무이자", "할부"],
    "무이자 할부": ["무이자", "할부"],
    카드사부담무이할부: ["카드사", "부담", "무이자 할부"],
    카드사무이자할부: ["카드사", "무이자 할부"],
    카드사부분무이자할부: ["카드사", "부분", "무이자 할부"],
    "카드사 무이자 할부": ["카드사", "무이자 할부"],
    부분무이자할부: ["부분", "무이자 할부"],
    "부분 무이자 할부": ["부분", "무이자 할부"],
    "부분무이자 할부": ["부분", "무이자 할부"],
    "부분 무이자할부": ["부분", "무이자 할부"],
    가상계좌발급: ["가상계좌 발급"],
    "결제 위젯": ["결제위젯", "위젯"],
    메서드: ["method", "함수"],
    JavaScriptSDK: ["JavaScript SDK", "JavaScript", "SDK"],

    // English synonyms (stored in lowercase)
    payment: ["pay", "transaction", "checkout"],
    cancel: ["cancellation", "refund", "void"],
    "payment cancellation": ["cancel payment", "refund", "payment cancel"],
    "partial cancellation": ["partial refund", "partial cancel"],
    refund: ["refund policy", "return"],
    settlement: ["payout", "disbursement"],
    "virtual account": ["vaccount", "bank transfer", "wire transfer"],
    installment: ["installments", "payment plan", "monthly payment"],
    "interest-free": ["zero interest", "no interest", "0% interest"],
    "interest-free installment": ["zero interest installment"],
    card: ["credit card", "debit card", "card payment"],
    authorization: ["auth", "approval", "authorize"],
    authentication: ["verified payment", "3ds", "secure payment"],
    widget: ["payment widget", "checkout widget"],
    sdk: ["software development kit", "library", "javascript sdk"],
    api: ["endpoint", "integration", "rest api"],
    method: ["function", "api method"],
    error: ["error code", "failure", "exception"],
    integration: ["integrate", "implementation", "setup"],
  };

  getSynonyms(term: string): string[] {
    const normalizedTerm = this.normalizeTerm(term);
    return this.dictionary[normalizedTerm] || [];
  }

  convertToSynonyms(terms: string[]): string[] {
    const synonyms: string[] = [];
    for (const term of terms) {
      const termSynonyms = this.getSynonyms(term);
      if (termSynonyms.length > 0) {
        synonyms.push(...termSynonyms);
      } else {
        synonyms.push(term);
      }
    }
    return synonyms;
  }

  /**
   * Normalize term for dictionary lookup.
   * Korean terms are kept as-is, English terms are converted to lowercase.
   */
  private normalizeTerm(term: string): string {
    // Keep Korean terms as-is
    if (/[가-힣]/.test(term)) {
      return term;
    }
    // Convert English terms to lowercase for case-insensitive matching
    return term.toLowerCase().trim();
  }
}
