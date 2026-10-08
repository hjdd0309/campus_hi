import React from "react";

const paths = {
  back: "m14 6-6 6 6 6",
  next: "m10 6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  home: "m3 10 9-7 9 7v10h-6v-7H9v7H3Z",
  cap: "m2 8 10-5 10 5-10 5Zm4 3v6q6 5 12 0v-6M22 8v8",
  layers: "m3 7 9-5 9 5-9 5Zm0 5 9 5 9-5M3 17l9 5 9-5",
  book: "M5 3h14v18l-7-4-7 4Z",
  heart: "M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5Z",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  bell: "M5 9a7 7 0 0 1 14 0v7l2 2H3l2-2Zm5 12h4",
  sparkle: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM20 1v4m-2-2h4",
  chat: "M3 4h18v13H10l-5 4v-4H3Z",
  bulb: "M9 19h6m-5 3h4M8 16c0-3-4-4-4-8a8 8 0 0 1 16 0c0 4-4 5-4 8Z",
  flask: "M9 2h6m-5 0v7L3 20q-1 2 2 2h14q3 0 2-2L14 9V2M7 15h10",
  palette:
    "M12 2a10 10 0 1 0 0 20c3 0 3-3 2-4s-1-3 2-3h3c6 0 3-13-7-13ZM7 8h.01M12 6h.01M17 8h.01M6 13h.01",
  brain:
    "M12 5C9-2 2 3 5 8c-5 1-4 8 0 9-1 6 7 6 7 1V5Zm0 0c3-7 10-2 7 3 5 1 4 8 0 9 1 6-7 6-7 1M8 8l4 3m5 3-5 2",
  film: "M3 7h18v14H3Zm0 0 17-5 1 5M6 3l3 3m4-5 3 3M9 12l6 3-6 3Z",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18",
  pause: "M6 3h4v18H6Zm8 0h4v18h-4Z",
  swap: "M3 7h17l-4-4m5 14H4l4 4M3 7v4m18 6v-4",
  file: "M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8m-8 4h8",
  pen: "m4 16 12-12 4 4L8 20l-5 1Zm10-10 4 4",
  close: "m6 6 12 12M6 18 18 6",
  download: "M12 2v13m-5-5 5 5 5-5M3 16v6h18v-6",
};

export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.sparkle} />
    </svg>
  );
}
