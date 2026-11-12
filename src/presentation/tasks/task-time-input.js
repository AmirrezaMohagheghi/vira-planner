export function createTaskTimeInput({ hourInput, minuteInput, timeInput }) {
  function updateValue() {
    const hourEmpty = hourInput.value === "";
    const minuteEmpty = minuteInput.value === "";
    hourInput.setCustomValidity("");
    minuteInput.setCustomValidity("");

    if (hourEmpty && minuteEmpty) {
      timeInput.value = "";
      return;
    }

    if (hourEmpty || minuteEmpty) {
      const message = "برای واردکردن ساعت، ساعت و دقیقه را هر دو مشخص کن.";
      hourInput.setCustomValidity(message);
      minuteInput.setCustomValidity(message);
      timeInput.value = "";
      return;
    }

    const hour = Number(hourInput.value);
    const minute = Number(minuteInput.value);

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      hourInput.setCustomValidity("ساعت باید بین ۰ تا ۲۳ باشد.");
    }

    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      minuteInput.setCustomValidity("دقیقه باید بین ۰ تا ۵۹ باشد.");
    }

    timeInput.value =
      hourInput.validationMessage || minuteInput.validationMessage
        ? ""
        : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function setValue(value) {
    const [hour = "", minute = ""] = (value || "").split(":");
    hourInput.value = hour === "" ? "" : String(Number(hour));
    minuteInput.value = minute === "" ? "" : String(Number(minute));
    updateValue();
  }

  function clear() {
    hourInput.setCustomValidity("");
    minuteInput.setCustomValidity("");
    timeInput.value = "";
  }

  hourInput.addEventListener("input", updateValue);
  minuteInput.addEventListener("input", updateValue);
  hourInput.addEventListener("change", updateValue);
  minuteInput.addEventListener("change", updateValue);

  return {
    updateValue,
    setValue,
    clear,
    getValue: () => timeInput.value
  };
}
