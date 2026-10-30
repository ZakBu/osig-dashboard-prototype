// Базовый префикс приложения (Next.js basePath). На проде — «/azs»,
// локально без basePath — пустая строка. Нужен для raw fetch() и <img src>,
// которые Next не префиксует автоматически (в отличие от next/link и next/image).
export const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Абсолютный путь к статике/эндпоинту с учётом basePath: asset("/api/trend"). */
export const asset = (path: string) => `${BP}${path}`;
