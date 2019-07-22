export default (num: string, base: number, defaultNumber?: number) => {
  const parsedNumber: number = parseInt(num, base);

  if (isNaN(parsedNumber)) {
    return defaultNumber;
  }

  return parsedNumber;
};
