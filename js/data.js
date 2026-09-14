window.WEDDING_DATA = {
  couple: {
    groom: {
      name: "이우빈",
      displayName: "우빈",
      english: "WOOBIN",
      father: "이성주",
      mother: "고인숙",
      relation: "장남"
    },
    bride: {
      name: "이경진",
      displayName: "경진",
      english: "KYOUNGJIN",
      father: "이재석",
      mother: "김전미",
      relation: "장녀"
    }
  },
  // 혼주 전화번호를 문자열로 입력하세요. 비워 두면 전화·문자 버튼이 비활성화됩니다.
  // 성함은 위 couple의 father, mother 값을 함께 사용합니다.
  // 아래 번호는 화면 확인용 임시 번호입니다. 실제 연락처로 교체해 주세요.
  contacts: {
    groom: { father: "", mother: "010-3583-7134" },
    bride: { father: "", mother: "010-6646-5604" }
  },
  wedding: {
    date: "2026-10-03"
  },
  copy: {
    invitation: [
      "저희 두 사람, 결혼합니다.",
      "함께 시간을 보내며<br>서로의 일상을 가장 가까이에서 나누는 일이<br>어느새 자연스러운 일이 되었습니다.",
      "그렇게 함께한 시간을 지나<br>앞으로의 날들도 서로의 곁에서<br>함께 살아가기로 했습니다.",
      "저희 결혼식은 양가 가족과 함께하는 작은 자리로<br>조용히 치르려 합니다.",
      "직접 모시고 인사드리지 못하지만<br>멀리서도 저희의 새로운 시작을 기쁘게 기억해 주시고<br>따뜻한 마음으로 축복해 주시면 감사하겠습니다."
    ],
    outro: "전해주신 따뜻한 마음<br>오래도록 소중히 간직하겠습니다.<br><br>작은 일에도 고마움을 표현하며<br>늘 아끼고 존중하는 부부로<br>행복하게 잘 살아가겠습니다."
  },
  // 은행(bank), 계좌번호(number), 예금주(holder)를 모두 입력하면 표시됩니다.
  // 계좌번호는 앞자리 0과 하이픈을 유지하도록 따옴표 안에 입력하세요.
  accounts: {
    groom: [
      { label: "신랑", bank: "", number: "", holder: "이우빈" },
      { label: "신랑 아버지", bank: "", number: "", holder: "이성주" },
      { label: "신랑 어머니", bank: "", number: "", holder: "고인숙" }
    ],
    bride: [
      { label: "신부", bank: "", number: "", holder: "이경진" },
      { label: "신부 아버지", bank: "", number: "", holder: "이재선" },
      { label: "신부 어머니", bank: "", number: "", holder: "김전미" }
    ]
  },
  images: {
    hero: "./assets/images/main.png",
    gallery: [
      "./assets/images/gallery/01.png",
      "./assets/images/gallery/02.png",
      "./assets/images/gallery/03.png",
      "./assets/images/gallery/04.png",
      "./assets/images/gallery/05.png",
      "./assets/images/gallery/06.png",
      "./assets/images/gallery/07.png",
      "./assets/images/gallery/08.png",
      "./assets/images/gallery/09.png",
      "./assets/images/gallery/10.png",
      "./assets/images/gallery/11.png",
      "./assets/images/gallery/12.png",
      "./assets/images/gallery/13.png",
      "./assets/images/gallery/14.png",
      "./assets/images/gallery/15.png"
    ]
  }
};
