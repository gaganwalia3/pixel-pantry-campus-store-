const ALIAS_GROUPS = [
    [
        'airpods',
        'airpod',
        'airdopes',
        'air buds',
        'earbuds',
        'earphones',
        'tws',
        'buds',
    ],

    [
        'phone',
        'smartphone',
        'mobile',
    ],

    [
        'laptop',
        'notebook',
    ],

    [
        'charger',
        'charging adapter',
        'power adapter',
    ],

    [
        'headphones',
        'headset',
        'headphone',
    ],

    [
        'powerbank',
        'power bank',
        'portable charger',
    ],

    [
        'sneakers',
        'shoes',
        'trainers',
    ],
];

const normalize = (value) => {
    if (
        value === undefined ||
        value === null
    ) {
        return '';
    }

    return String(value)
        .toLowerCase()
        .normalize('NFKD')
        .replace(
            /[\u0300-\u036f]/g,
            '',
        )
        .replace(
            /[^a-z0-9]+/g,
            ' ',
        )
        .replace(
            /\s+/g,
            ' ',
        )
        .trim();
};

const tokenize = (value) => {
    const normalized =
        normalize(value);

    if (!normalized) {
        return [];
    }

    return normalized
        .split(' ')
        .filter(Boolean);
};

const levenshteinDistance = (
    left,
    right,
) => {
    const a = normalize(left);
    const b = normalize(right);

    if (a === b) {
        return 0;
    }

    if (!a) {
        return b.length;
    }

    if (!b) {
        return a.length;
    }

    const previous =
        Array.from(
            {
                length:
                    b.length + 1,
            },
            (_, index) => index,
        );

    for (
        let i = 1;
        i <= a.length;
        i += 1
    ) {
        const current = [
            i,
        ];

        for (
            let j = 1;
            j <= b.length;
            j += 1
        ) {
            const insertion =
                current[j - 1] + 1;

            const deletion =
                previous[j] + 1;

            const substitution =
                previous[j - 1] +
                (
                    a[i - 1] ===
                        b[j - 1]
                        ? 0
                        : 1
                );

            current[j] =
                Math.min(
                    insertion,
                    deletion,
                    substitution,
                );
        }

        for (
            let j = 0;
            j < current.length;
            j += 1
        ) {
            previous[j] =
                current[j];
        }
    }

    return previous[
        b.length
    ];
};

const fuzzySimilarity = (
    left,
    right,
) => {
    const a = normalize(left);
    const b = normalize(right);

    if (!a || !b) {
        return 0;
    }

    if (a === b) {
        return 1;
    }

    const distance =
        levenshteinDistance(
            a,
            b,
        );

    const longest =
        Math.max(
            a.length,
            b.length,
        );

    if (!longest) {
        return 0;
    }

    return (
        1 -
        distance / longest
    );
};

const getAliasTerms = (
    query,
) => {
    const normalized =
        normalize(query);

    if (!normalized) {
        return [];
    }

    const aliases =
        new Set();

    for (
        const group of ALIAS_GROUPS
    ) {
        if (
            group.some(
                (term) =>
                    normalize(term) ===
                    normalized,
            )
        ) {
            group.forEach(
                (term) =>
                    aliases.add(
                        normalize(term),
                    ),
            );
        }
    }

    return Array.from(
        aliases,
    );
};

const scoreText = (
    query,
    text,
) => {
    const normalizedQuery =
        normalize(query);

    const normalizedText =
        normalize(text);

    if (
        !normalizedQuery ||
        !normalizedText
    ) {
        return 0;
    }

    if (
        normalizedText ===
        normalizedQuery
    ) {
        return 100;
    }

    if (
        normalizedText.includes(
            normalizedQuery,
        )
    ) {
        return 90;
    }

    const queryTokens =
        tokenize(normalizedQuery);

    const textTokens =
        tokenize(normalizedText);

    let bestTokenScore = 0;

    for (
        const queryToken of queryTokens
    ) {
        for (
            const textToken of textTokens
        ) {
            if (
                queryToken ===
                textToken
            ) {
                bestTokenScore =
                    Math.max(
                        bestTokenScore,
                        90,
                    );

                continue;
            }

            if (
                textToken.includes(
                    queryToken,
                ) ||
                queryToken.includes(
                    textToken,
                )
            ) {
                bestTokenScore =
                    Math.max(
                        bestTokenScore,
                        75,
                    );

                continue;
            }

            const similarity =
                fuzzySimilarity(
                    queryToken,
                    textToken,
                );

            if (
                similarity >= 0.8
            ) {
                bestTokenScore =
                    Math.max(
                        bestTokenScore,
                        70,
                    );
            } else if (
                similarity >= 0.65
            ) {
                bestTokenScore =
                    Math.max(
                        bestTokenScore,
                        50,
                    );
            }
        }
    }

    return bestTokenScore;
};

const scoreProduct = (
    query,
    product,
) => {
    const normalizedQuery =
        normalize(query);

    if (!normalizedQuery) {
        return 0;
    }

    const fields = [
        {
            value:
                product.name,
            weight: 1,
        },
        {
            value:
                product.brand_name,
            weight: 0.9,
        },
        {
            value:
                product.category_name,
            weight: 0.8,
        },
        {
            value:
                product.description,
            weight: 0.65,
        },
        {
            value:
                product.shop_name,
            weight: 0.5,
        },
    ];

    let bestScore = 0;

    for (
        const field of fields
    ) {
        const score =
            scoreText(
                normalizedQuery,
                field.value,
            ) *
            field.weight;

        bestScore =
            Math.max(
                bestScore,
                score,
            );
    }

    const aliases =
        getAliasTerms(
            normalizedQuery,
        );

    for (
        const alias of aliases
    ) {
        if (
            alias ===
            normalizedQuery
        ) {
            continue;
        }

        for (
            const field of fields
        ) {
            const score =
                scoreText(
                    alias,
                    field.value,
                ) *
                field.weight;

            if (score > 0) {
                bestScore =
                    Math.max(
                        bestScore,
                        score * 0.88,
                    );
            }
        }
    }

    return Math.round(
        bestScore,
    );
};

const rankProducts = (
    query,
    products,
) => {
    const normalizedQuery =
        normalize(query);

    if (!normalizedQuery) {
        return products;
    }

    return products
        .map(
            (
                product,
                index,
            ) => ({
                product,
                score:
                    scoreProduct(
                        normalizedQuery,
                        product,
                    ),
                index,
            }),
        )
        .filter(
            ({
                score,
            }) =>
                score >= 45,
        )
        .sort(
            (
                left,
                right,
            ) => {
                if (
                    right.score !==
                    left.score
                ) {
                    return (
                        right.score -
                        left.score
                    );
                }

                return (
                    left.index -
                    right.index
                );
            },
        )
        .map(
            ({
                product,
            }) => product,
        );
};

module.exports = {
    normalize,
    tokenize,
    fuzzySimilarity,
    scoreProduct,
    rankProducts,
};