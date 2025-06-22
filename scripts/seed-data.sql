-- Seed data for KAIROS Stock Analysis Database
-- This script adds some initial stocks for testing
-- Insert some popular stocks for testing
INSERT INTO
  stocks (
    id,
    ticker,
    name,
    sector,
    industry,
    "createdAt",
    "updatedAt",
    "isActive"
  )
VALUES
  (
    'clm1',
    'AAPL',
    'Apple Inc.',
    'Technology',
    'Consumer Electronics',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm2',
    'MSFT',
    'Microsoft Corporation',
    'Technology',
    'Software',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm3',
    'GOOGL',
    'Alphabet Inc.',
    'Technology',
    'Internet Services',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm4',
    'AMZN',
    'Amazon.com Inc.',
    'Consumer Cyclical',
    'Internet Retail',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm5',
    'TSLA',
    'Tesla Inc.',
    'Consumer Cyclical',
    'Auto Manufacturers',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm6',
    'NVDA',
    'NVIDIA Corporation',
    'Technology',
    'Semiconductors',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm7',
    'META',
    'Meta Platforms Inc.',
    'Technology',
    'Internet Services',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm8',
    'BRK.A',
    'Berkshire Hathaway Inc.',
    'Financial Services',
    'Insurance',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm9',
    'JNJ',
    'Johnson & Johnson',
    'Healthcare',
    'Drug Manufacturers',
    NOW (),
    NOW (),
    true
  ),
  (
    'clm10',
    'V',
    'Visa Inc.',
    'Financial Services',
    'Credit Services',
    NOW (),
    NOW (),
    true
  ) ON CONFLICT (ticker) DO NOTHING;

-- Insert a sample portfolio
INSERT INTO
  portfolios (
    id,
    name,
    description,
    "initialValue",
    "currentValue",
    cash,
    "totalReturn",
    "dailyReturn",
    "isActive",
    "createdAt",
    "updatedAt"
  )
VALUES
  (
    'p1',
    'Sample Portfolio',
    'A sample portfolio for testing purposes',
    100000.00,
    100000.00,
    100000.00,
    0.00,
    0.00,
    true,
    NOW (),
    NOW ()
  ) ON CONFLICT (id) DO NOTHING;

-- Insert some sample portfolio positions
INSERT INTO
  portfolio_positions (
    id,
    "portfolioId",
    "stockId",
    ticker,
    quantity,
    "averagePrice",
    "currentPrice",
    "unrealizedPnL",
    value,
    weight,
    sector,
    "lastUpdated"
  )
VALUES
  (
    'pp1',
    'p1',
    'clm1',
    'AAPL',
    10,
    150.00,
    150.00,
    0.00,
    1500.00,
    1.5,
    'Technology',
    NOW ()
  ),
  (
    'pp2',
    'p1',
    'clm2',
    'MSFT',
    8,
    300.00,
    300.00,
    0.00,
    2400.00,
    2.4,
    'Technology',
    NOW ()
  ),
  (
    'pp3',
    'p1',
    'clm6',
    'NVDA',
    5,
    400.00,
    400.00,
    0.00,
    2000.00,
    2.0,
    'Technology',
    NOW ()
  ) ON CONFLICT (id) DO NOTHING;

-- Insert some sample historical data for AAPL (last 30 days)
INSERT INTO
  historical_data (
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    "stockId"
  )
VALUES
  (
    NOW () - INTERVAL '30 days',
    145.00,
    147.00,
    144.00,
    146.50,
    50000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '29 days',
    146.50,
    148.00,
    145.50,
    147.80,
    48000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '28 days',
    147.80,
    149.50,
    147.00,
    148.90,
    52000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '27 days',
    148.90,
    150.00,
    148.50,
    149.20,
    49000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '26 days',
    149.20,
    151.00,
    148.80,
    150.50,
    51000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '25 days',
    150.50,
    152.00,
    149.50,
    151.20,
    53000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '24 days',
    151.20,
    153.00,
    150.80,
    152.40,
    47000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '23 days',
    152.40,
    154.00,
    151.50,
    153.10,
    54000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '22 days',
    153.10,
    155.00,
    152.80,
    154.30,
    50000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '21 days',
    154.30,
    156.00,
    153.50,
    155.20,
    52000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '20 days',
    155.20,
    157.00,
    154.80,
    156.40,
    48000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '19 days',
    156.40,
    158.00,
    155.50,
    157.10,
    51000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '18 days',
    157.10,
    159.00,
    156.80,
    158.30,
    53000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '17 days',
    158.30,
    160.00,
    157.50,
    159.20,
    49000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '16 days',
    159.20,
    161.00,
    158.80,
    160.40,
    52000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '15 days',
    160.40,
    162.00,
    159.50,
    161.10,
    54000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '14 days',
    161.10,
    163.00,
    160.80,
    162.30,
    50000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '13 days',
    162.30,
    164.00,
    161.50,
    163.20,
    48000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '12 days',
    163.20,
    165.00,
    162.80,
    164.40,
    51000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '11 days',
    164.40,
    166.00,
    163.50,
    165.10,
    53000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '10 days',
    165.10,
    167.00,
    164.80,
    166.30,
    49000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '9 days',
    166.30,
    168.00,
    165.50,
    167.20,
    52000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '8 days',
    167.20,
    169.00,
    166.80,
    168.40,
    54000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '7 days',
    168.40,
    170.00,
    167.50,
    169.10,
    50000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '6 days',
    169.10,
    171.00,
    168.80,
    170.30,
    48000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '5 days',
    170.30,
    172.00,
    169.50,
    171.20,
    51000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '4 days',
    171.20,
    173.00,
    170.80,
    172.40,
    53000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '3 days',
    172.40,
    174.00,
    171.50,
    173.10,
    49000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '2 days',
    173.10,
    175.00,
    172.80,
    174.30,
    52000000,
    'clm1'
  ),
  (
    NOW () - INTERVAL '1 day',
    174.30,
    176.00,
    173.50,
    175.20,
    54000000,
    'clm1'
  ),
  (
    NOW (),
    175.20,
    177.00,
    174.80,
    176.40,
    50000000,
    'clm1'
  ) ON CONFLICT ("stockId", timestamp) DO NOTHING;

-- Update portfolio values based on current stock prices
UPDATE portfolios
SET
  "currentValue" = (
    SELECT
      COALESCE(SUM(value), 0)
    FROM
      portfolio_positions
    WHERE
      "portfolioId" = 'p1'
  ) + cash
WHERE
  id = 'p1';

-- Update portfolio positions with current prices
UPDATE portfolio_positions
SET
  "currentPrice" = 176.40,
  value = quantity * 176.40,
  "unrealizedPnL" = (176.40 - "averagePrice") * quantity,
  "lastUpdated" = NOW ()
WHERE
  ticker = 'AAPL';

UPDATE portfolio_positions
SET
  "currentPrice" = 300.00,
  value = quantity * 300.00,
  "unrealizedPnL" = (300.00 - "averagePrice") * quantity,
  "lastUpdated" = NOW ()
WHERE
  ticker = 'MSFT';

UPDATE portfolio_positions
SET
  "currentPrice" = 400.00,
  value = quantity * 400.00,
  "unrealizedPnL" = (400.00 - "averagePrice") * quantity,
  "lastUpdated" = NOW ()
WHERE
  ticker = 'NVDA';

-- Update portfolio weights
UPDATE portfolio_positions
SET
  weight = (
    value / (
      SELECT
        "currentValue"
      FROM
        portfolios
      WHERE
        id = 'p1'
    )
  ) * 100
WHERE
  "portfolioId" = 'p1';

COMMENT ON TABLE stocks IS 'Sample stock data seeded for testing';

COMMENT ON TABLE portfolios IS 'Sample portfolio for testing';

COMMENT ON TABLE portfolio_positions IS 'Sample portfolio positions for testing';

COMMENT ON TABLE historical_data IS 'Sample historical data for AAPL (last 30 days)';
