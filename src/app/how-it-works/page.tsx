import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "How It Works | PVQ-TM",
  description:
    "A plain-language guide to how PVQ-TM measures transferable skills and post-injury earning capacity.",
};

/* ------------------------------------------------------------------ */
/*  Reusable layout components                                         */
/* ------------------------------------------------------------------ */

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-bold mt-12 mb-4 flex items-center gap-3">
        <Badge variant="outline" className="text-sm font-mono shrink-0">
          {number}
        </Badge>
        {title}
      </h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Callout({
  title,
  children,
  color = "blue",
}: {
  title: string;
  children: React.ReactNode;
  color?: "blue" | "green" | "amber" | "red";
}) {
  const borderColor = {
    blue: "border-l-blue-500",
    green: "border-l-green-500",
    amber: "border-l-amber-500",
    red: "border-l-red-500",
  }[color];

  return (
    <Card className={`my-4 border-l-4 ${borderColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground leading-relaxed">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreCard({
  abbreviation,
  name,
  question,
  description,
}: {
  abbreviation: string;
  name: string;
  question: string;
  description: string;
}) {
  return (
    <Card className="my-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Badge className="font-mono">{abbreviation}</Badge>
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-foreground italic mb-2">
          &ldquo;{question}&rdquo;
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          How PVQ-TM Works
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          A plain-language guide for attorneys, adjusters, and anyone who needs
          to understand how we measure post-injury earning capacity.
        </p>
      </div>

      <Separator />

      {/* ── 1. The Big Picture ────────────────────────────────── */}
      <Section id="big-picture" number="1" title="The Big Picture">
        <p>
          When a person is injured and can no longer perform the work they did
          before, a critical question arises:{" "}
          <strong>what can they still do, and what will it pay?</strong> That
          question sits at the heart of personal injury litigation, workers&apos;
          compensation claims, and Social Security disability cases.
        </p>
        <p>
          A Vocational Expert (VE) answers it by performing what is called a{" "}
          <strong>Transferable Skills Analysis</strong>, or TSA. Think of a TSA
          as a structured matching process: we take the skills someone learned in
          their old jobs, compare them to the requirements of hundreds of other
          occupations, filter out anything they physically or mentally cannot do
          after their injury, and identify the jobs that remain. Those surviving
          jobs, and their wages, tell us what the person&apos;s post-injury
          earning capacity looks like.
        </p>
        <p>
          PVQ-TM is the system that performs this analysis. It is not a black
          box. Every formula is published. Every data source is a government
          database. Every step can be reproduced by an opposing expert. This page
          explains, in plain language, what happens from start to finish.
        </p>
      </Section>

      {/* ── 2. What We Start With ─────────────────────────────── */}
      <Section id="starting-data" number="2" title="What We Start With">
        <p>
          Before the system can find matching jobs, we need four categories of
          information about the injured person:
        </p>

        <Callout title="Demographics" color="blue">
          <p>
            Basic information about the person: age, education, and where they
            live. Age matters because Social Security has stricter rules for
            older workers. Location matters because job availability varies by
            region.
          </p>
        </Callout>

        <Callout title="Past Relevant Work (PRW)" color="blue">
          <p>
            The jobs the person held over roughly the last 15 years. For each
            job, we record what they actually did day to day, what tools they
            used, what skills they developed, and how complex the work was. We
            use a government measure called SVP (Specific Vocational
            Preparation) to rate complexity. An SVP of 1 means the job can be
            learned in a short demonstration. An SVP of 8 means it requires
            years of training, like a surgeon.
          </p>
        </Callout>

        <Callout title="Skills From Those Jobs" color="blue">
          <p>
            Not everything a person does at work counts as a transferable skill.
            Under Social Security policy, a transferable skill must come from
            work that was at least semi-skilled (SVP 4 or higher) and must
            involve real judgment or technique learned over more than 30 days.
            Being friendly or showing up on time are valuable qualities, but
            they are not transferable skills in this analysis. Knowing how to
            operate accounting software, read blueprints, or manage inventory
            records are.
          </p>
        </Callout>

        <Callout title="Post-Injury Profile (What the Doctor Says)" color="blue">
          <p>
            Based on medical records, physician reports, or a Functional
            Capacity Evaluation (FCE), we build a profile of what the person can
            still do after their injury. This profile tracks 24 specific traits
            across three groups:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>6 Aptitudes</strong> &mdash; reasoning ability, math
              skills, language ability, spatial perception, form perception, and
              clerical perception.
            </li>
            <li>
              <strong>11 Physical Abilities</strong> &mdash; strength level
              (sedentary through very heavy), finger dexterity, manual
              dexterity, motor coordination, climbing, stooping, reaching, and
              more.
            </li>
            <li>
              <strong>7 Environmental Tolerances</strong> &mdash; ability to
              tolerate cold, heat, humidity, noise, dust, fumes, and hazardous
              conditions.
            </li>
          </ul>
          <p className="mt-2">
            Each trait is rated on a simple 0-to-4 scale, where 0 means no
            capacity at all and 4 means full, unrestricted capacity.
          </p>
        </Callout>
      </Section>

      {/* ── 3. How We Find Matching Jobs ──────────────────────── */}
      <Section
        id="five-steps"
        number="3"
        title="How We Find Matching Jobs: The Five-Step Process"
      >
        <p>
          With all the starting data in hand, the system works through five
          steps. Think of it as a funnel: we start with a wide universe of
          possible jobs and progressively narrow it down to the ones that are
          realistic for this particular person.
        </p>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                Step 1
              </Badge>
              Document the Work History
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              We record every relevant job the person held, the specific tasks
              they performed, the tools and technology they used, and the skills
              they acquired. We cross-reference each job against the Dictionary
              of Occupational Titles (DOT) and the O*NET database to ensure we
              are using standardized occupational descriptions, not just the
              person&apos;s subjective recollection.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                Step 2
              </Badge>
              Search for Candidate Occupations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              The system searches through more than 900 O*NET occupations to
              find ones whose skill requirements overlap with the person&apos;s
              work history. This is similar to how a job search engine finds
              matches based on a resume, but far more structured. We compare
              tasks, work activities, tools, materials, and knowledge areas. If
              there is meaningful overlap, the occupation becomes a candidate.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4 border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                Step 3
              </Badge>
              The Hard Gate: Physical and Mental Screening
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              This is the most important filter. For every candidate job, we
              compare all 24 traits the job requires against the person&apos;s
              post-injury profile. If the job demands{" "}
              <strong>even one</strong> physical or mental ability that exceeds
              what the person can do, that job is eliminated. There is no
              averaging, no partial credit.
            </p>
            <p className="mt-2">
              For example, if a job requires medium-level strength (regularly
              lifting up to 50 pounds) but the doctor has restricted the person
              to sedentary work (lifting no more than 10 pounds), that job is
              out. It does not matter if the person is a perfect match in every
              other way.
            </p>
            <p className="mt-2 font-medium text-foreground">
              Think of it like a doorway: you either fit through it or you
              don&apos;t. Being close to fitting does not count.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                Step 4
              </Badge>
              Rate the Adjustment Required
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              For jobs that survive the hard gate, we assess how much
              adjustment the worker would need to transition into the new role.
              We look at four dimensions:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>Tools</strong> &mdash; Are the tools and technology
                similar to what they used before?
              </li>
              <li>
                <strong>Work Processes</strong> &mdash; Are the day-to-day
                procedures similar?
              </li>
              <li>
                <strong>Work Setting</strong> &mdash; Is the work environment
                similar (office vs. warehouse vs. outdoors)?
              </li>
              <li>
                <strong>Industry</strong> &mdash; Is it the same industry or a
                completely different one?
              </li>
            </ul>
            <p className="mt-2">
              This step is especially important for older workers. Under Social
              Security rules, workers of advanced age (55 and older) generally
              can only be directed to jobs that require very little or no
              vocational adjustment.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                Step 5
              </Badge>
              Check the Labor Market
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              A job that exists on paper but has no openings in the real economy
              is not a viable option. In this final step, we pull data from the
              Bureau of Labor Statistics (BLS) to verify that each surviving
              occupation has meaningful employment numbers, reasonable wages, and
              a future. We look at:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>How many people currently hold this job nationally</li>
              <li>What the job pays (median and percentile wages)</li>
              <li>Whether the occupation is growing or shrinking</li>
              <li>How many openings are projected</li>
            </ul>
          </CardContent>
        </Card>
      </Section>

      {/* ── 4. The Four Scores ────────────────────────────────── */}
      <Section id="four-scores" number="4" title="The Four Scores">
        <p>
          Each surviving occupation receives four scores. Together, these scores
          answer the question: how good a fit is this job for this particular
          person?
        </p>

        <ScoreCard
          abbreviation="STQ"
          name="Skill Transfer Quotient"
          question="How much do your old skills overlap with this new job's requirements?"
          description="Scored from 0 to 100. A high STQ means the person already knows how to do most of what the new job requires. We measure this by comparing tasks, work activities, tools, materials, and knowledge between the old jobs and the new one. A score of 80, for example, means roughly 80% of what the new job needs, the person already brings from their prior work."
        />

        <ScoreCard
          abbreviation="TFQ"
          name="Trait Feasibility Quotient"
          question="Can you physically and mentally do this job given your limitations?"
          description="This score works in two stages. First, it is a hard pass/fail: if any of the 24 traits fails, the job is eliminated entirely (see Step 3 above). For jobs that pass, the TFQ then measures how much margin the person has. A higher TFQ means the person's abilities comfortably exceed what the job demands. A lower TFQ means they just barely clear the bar. Think of it as the difference between a bridge rated for 20 tons carrying a 10-ton truck (comfortable margin) versus carrying an 18-ton truck (just barely safe)."
        />

        <ScoreCard
          abbreviation="VAQ"
          name="Vocational Adjustment Quotient"
          question="How different is this new job from what you're used to?"
          description="Scored from 0 to 100, where 100 means the new job is essentially the same work environment, tools, and processes the person already knows, and 0 means everything is completely different. For most people, some adjustment is expected. But for older workers under Social Security rules, only jobs with very little adjustment (scores near 100) qualify."
        />

        <ScoreCard
          abbreviation="LMQ"
          name="Labor Market Quotient"
          question="Is this job realistic to get? Are there enough openings and does it pay enough?"
          description="Scored from 0 to 100. This score checks whether the job exists in meaningful numbers in the real economy, whether it pays a competitive wage compared to what the person earned before, and whether the occupation is projected to grow. A job that is a perfect skills match but only employs 200 people nationwide would score low here."
        />
      </Section>

      {/* ── 5. The Final PVQ Score ────────────────────────────── */}
      <Section id="pvq-score" number="5" title="Combining It All: The PVQ Score">
        <p>
          The four scores above are combined into one overall number called the{" "}
          <strong>
            Public Vocational Quotient (PVQ)
          </strong>
          . The formula is:
        </p>

        <Card className="my-4 border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              PVQ Formula
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block bg-muted rounded-md px-4 py-3 text-sm font-mono whitespace-pre-wrap">
              PVQ = (0.45 x STQ) + (0.25 x TFQ) + (0.15 x VAQ) + (0.15 x LMQ)
            </code>
            <div className="mt-4 text-sm text-muted-foreground space-y-2">
              <p>In plain English, skill transfer counts the most:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>45% Skill Transfer (STQ)</strong> &mdash; Can the
                  person actually do the work based on their experience?
                </li>
                <li>
                  <strong>25% Trait Feasibility (TFQ)</strong> &mdash; How much
                  physical and mental margin do they have?
                </li>
                <li>
                  <strong>15% Vocational Adjustment (VAQ)</strong> &mdash; How
                  big a change is this from their prior work?
                </li>
                <li>
                  <strong>15% Labor Market (LMQ)</strong> &mdash; Does this job
                  exist in sufficient numbers at reasonable pay?
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Callout title="Why Does Skill Transfer Get the Most Weight?" color="amber">
          <p>
            Skill transfer receives 45% of the weight because it is the central
            question in both Social Security policy and vocational
            rehabilitation: does the person already possess the skills needed to
            perform this other work? The Social Security Administration&apos;s
            regulations specifically define disability in terms of whether a
            person&apos;s skills transfer to other work that exists in
            significant numbers. If a person has the skills, the other factors
            matter. If they do not, the other factors are irrelevant.
          </p>
        </Callout>

        <p>
          The final PVQ score ranges from 0 to 100. A higher score means the
          occupation is a stronger match overall. The system uses PVQ to rank
          all surviving occupations from best fit to worst fit, so that the
          Vocational Expert and the attorneys reviewing the report can see, at a
          glance, which jobs represent the most realistic alternatives.
        </p>
      </Section>

      {/* ── 6. Earning Capacity ───────────────────────────────── */}
      <Section
        id="earning-capacity"
        number="6"
        title="The Earning Capacity Connection"
      >
        <p>
          This is where the analysis connects directly to the dollar figure at
          the center of most litigation: <strong>loss of earning capacity</strong>.
        </p>
        <p>
          After the five-step process above, we have a list of occupations the
          person can realistically perform. Each of those occupations comes with
          wage data from the Bureau of Labor Statistics, including median wages
          and a full distribution (what the 10th, 25th, 75th, and 90th
          percentile earners make).
        </p>
        <p>
          The wages for these viable post-injury occupations represent the
          person&apos;s <strong>post-injury earning capacity</strong> &mdash; what
          they can reasonably be expected to earn going forward. We compare
          that to their <strong>pre-injury earnings</strong> (what they actually
          earned before the injury) or their pre-injury earning capacity (what
          they could have earned).
        </p>

        <Callout title="The Simple Equation" color="green">
          <p className="text-base font-medium text-foreground">
            Loss of Earning Capacity = Pre-Injury Earnings &minus; Post-Injury
            Earning Capacity
          </p>
          <p className="mt-2">
            If Jane earned $42,000 per year before her injury and the best jobs
            she can still do pay a median of $31,000, her annual loss of earning
            capacity is approximately $11,000. Over a working lifetime, that
            figure is multiplied by the number of remaining work years and
            adjusted to present value by an economist.
          </p>
        </Callout>

        <p>
          The strength of this approach is that every number in the equation is
          tied to verifiable data. The pre-injury earnings come from tax returns
          and employment records. The post-injury occupations come from the
          transferable skills analysis. The wages come from the Bureau of Labor
          Statistics. There is nothing subjective about the arithmetic.
        </p>
      </Section>

      {/* ── 7. Walk-Through Example ───────────────────────────── */}
      <Section
        id="example"
        number="7"
        title="A Walk-Through Example"
      >
        <Callout title="Meet Jane" color="blue">
          <p>
            Jane is 47 years old with a high school diploma and two years of
            community college coursework. For the past eight years, she worked as
            an Accounting Clerk at a manufacturing company, earning $42,000 per
            year. She processed invoices, reconciled accounts, managed vendor
            payments, and used QuickBooks and Excel daily. Her job was classified
            at SVP 6 (skilled work, requiring one to two years of training).
          </p>
          <p className="mt-2">
            Six months ago, Jane injured her back in a car accident. Her
            orthopedic surgeon has restricted her to sedentary work only: she can
            sit for most of the day, occasionally walk and stand, and lift no
            more than 10 pounds. She has no restrictions on her hands, cognitive
            abilities, or communication skills.
          </p>
        </Callout>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Step 1: Documenting Jane&apos;s Work History
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              The system records Jane&apos;s Accounting Clerk position with all
              its details: accounts payable/receivable tasks, data entry, vendor
              communication, use of accounting software, spreadsheet analysis.
              Her SVP of 6 confirms this was skilled work, meaning her skills are
              eligible for transfer.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Step 2: Finding Candidates
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              The system identifies occupations whose tasks and tools overlap
              with Jane&apos;s experience. Candidates might include: Bookkeeping
              Clerk, Payroll Clerk, Billing Clerk, Budget Analyst, Insurance
              Claims Clerk, and others. The initial candidate list might include
              30 to 40 occupations.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Step 3: The Hard Gate
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Each candidate is screened against Jane&apos;s post-injury profile.
              Any job requiring more than sedentary strength is eliminated. A
              Warehouse Inventory Clerk that requires light-to-medium lifting?
              Eliminated. A Purchasing Agent that requires occasional travel and
              moderate physical activity? Eliminated. Jobs like Bookkeeping Clerk
              (sedentary, office-based) pass through.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Step 4: Adjustment Rating
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              For a Bookkeeping Clerk position, the system rates the
              adjustment as minimal. Jane would use similar software tools
              (QuickBooks, Excel), follow similar accounting processes, work in a
              similar office setting, and potentially stay in the same industry.
              Her VAQ score would be high, near 100.
            </p>
            <p>
              For an Insurance Claims Clerk position, the adjustment is
              moderate. The tools overlap somewhat (she knows data entry and
              office software), but the work processes (processing claims rather
              than invoices), the setting, and the industry are different. Her
              VAQ would be lower, perhaps around 50.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Step 5: Labor Market Check
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              The system confirms that Bookkeeping Clerks employ over 1.5
              million people nationally with a median wage of approximately
              $47,000. The Insurance Claims Clerk field employs several hundred
              thousand with a median wage near $46,000. Both pass the labor
              market check easily.
            </p>
          </CardContent>
        </Card>

        <Card className="my-4 border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Jane&apos;s Results
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              The Bookkeeping Clerk position scores a PVQ of approximately 78
              out of 100: high skill transfer (similar tasks and tools), full
              trait feasibility (sedentary work matches her restrictions with
              margin to spare), minimal vocational adjustment, and strong labor
              market numbers.
            </p>
            <p>
              Jane&apos;s post-injury earning capacity, based on the best
              matching sedentary occupations and their BLS wage data, is
              approximately $38,000 to $47,000 per year.
            </p>
            <p>
              Compared to her pre-injury earnings of $42,000, Jane may have
              little or no loss of earning capacity for the top-matching
              occupations, or a modest loss for others. The full report lays out
              each occupation, its PVQ score, its wage range, and the resulting
              earning capacity comparison, so that attorneys on both sides can
              see exactly how the numbers were reached.
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* ── 8. Why This Matters ───────────────────────────────── */}
      <Section id="why-it-matters" number="8" title="Why This Approach Matters">
        <p>
          Many vocational analysis methods are proprietary. Their formulas are
          secret, their data sources are unclear, and opposing experts cannot
          reproduce their results. PVQ-TM was built to be the opposite of that.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Transparent Methodology
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Every formula, every weight, every threshold is published. There
              is no hidden algorithm. What you see on the Methodology page of
              this application is exactly what the software executes.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Government Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              All occupational data comes from public government databases:
              the Dictionary of Occupational Titles (DOT), the O*NET system,
              and the Bureau of Labor Statistics (BLS). These are the same
              sources Social Security uses.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Court-Defensible
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Because the methodology is transparent and the data is public,
              every conclusion can be examined, challenged, and verified.
              There are no appeals to authority or trust &mdash; only data and
              arithmetic.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Reproducible Results
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              An opposing expert using the same inputs and the same published
              methodology will arrive at the same results. This eliminates
              the &ldquo;dueling experts&rdquo; problem where two vocational
              analysts reach different conclusions using secret methods.
            </CardContent>
          </Card>
        </div>

        <Callout title="The Bottom Line" color="green">
          <p>
            PVQ-TM takes a complex vocational question &mdash; what can this
            person do and what will it pay &mdash; and answers it with a
            structured, transparent, reproducible process built entirely on
            public data. Whether you are the attorney presenting the analysis,
            the adjuster reviewing a claim, or the judge evaluating expert
            testimony, you can trace every number back to its source.
          </p>
        </Callout>
      </Section>
    </div>
  );
}
