export function formatReading(parameter: string, value: number, unit: string) {
  const formatted = (() => {
    switch (parameter) {
      case "TEMPERATURE":
        return value.toFixed(1);
      case "PH":
        return Number(value.toFixed(2)).toString();
      case "NITRATE":
      case "AMMONIA":
      case "NITRITE":
        return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
      case "TDS":
        return value.toFixed(0);
      case "TURBIDITY":
        return Number(value.toFixed(2)).toString();
      default:
        return Number(value.toFixed(2)).toString();
    }
  })();

  return `${formatted}${unit}`;
}
