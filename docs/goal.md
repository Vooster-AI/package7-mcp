## 목표

- tosspayemts-integration-mcp의 코드를 기반으로, 토스페이먼츠뿐 아니라 모든 라이브러리에 대해서 작동할 수 있는 범용 mcp 패키지를 만든다.
- 목적은 이 MCP 서버가 연결된 LLM Agent가, 특정 라이브러리에 대한 문서를 요청할 때 해당 라이브러리의 문서를 반환할 수 있도록 하는 것이다.
- 이를 위해 다음과 같인 작업이 필요하다.
    1. get-library-list tool 추가
        - 기능: 사용 가능한 라이브러리들의 목록을 반환
        - 입력: 없음
        - 예시 출력: ["tosspayments", "supabase", "clerk", ...]
    2. get-v1-documents tool 제거
    3. get-v2-documents tool을 get-documents tool로 이름 변경 및 다음과 같이 수정
        - 입력에 libraryId parameter 추가
    4. document-by-id tool의 입력에 libraryId parameter 추가
    5. tools.ts에서 호출되는 createTossPaymentDocsRepository가, tosspayments만이 아닌 사용가능한 모든 라이브러리에 대해 문서를 불러오도록 수정해야함

## 주의사항

- 사용 가능한 라이브러리 목록은 코드베이스상에 object array 변수로서 관리됨
    - 각 object는 다음 property를 가진다
        - id: string (라이브러리 식별자)
        - llmsTxtUrl: string (llms.txt 파일이 위치한 URL)

## 작업 지침

- 모든 변경에 대해서, 잘 수정되었음을 보장하기위한 테스트를 작성 후 통과함을 검증하라