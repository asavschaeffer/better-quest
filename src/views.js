export function setView({ view, views }) {
  const { homeView, setupView, sessionView, completeView } = views;

  if (view === "home") {
    if (homeView) homeView.classList.remove("bq-hidden");
    setupView.classList.add("bq-hidden");
    sessionView.classList.add("bq-hidden");
    completeView.classList.add("bq-hidden");
    return "home";
  }

  if (view === "questSetup") {
    if (homeView) homeView.classList.add("bq-hidden");
    setupView.classList.remove("bq-hidden");
    sessionView.classList.add("bq-hidden");
    completeView.classList.add("bq-hidden");
    return "questSetup";
  }

  if (view === "session") {
    if (homeView) homeView.classList.add("bq-hidden");
    setupView.classList.add("bq-hidden");
    sessionView.classList.remove("bq-hidden");
    completeView.classList.add("bq-hidden");
    return "session";
  }

  if (view === "complete") {
    if (homeView) homeView.classList.add("bq-hidden");
    setupView.classList.add("bq-hidden");
    sessionView.classList.add("bq-hidden");
    completeView.classList.remove("bq-hidden");
    return "complete";
  }

  return view;
}


