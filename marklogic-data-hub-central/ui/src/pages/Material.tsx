import React, {useState, useEffect, useContext} from "react";
import "./Material.scss";
import { withStyles, makeStyles } from '@material-ui/core/styles';
import { Button } from '@material-ui/core';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import Alert from '@material-ui/lab/Alert';
import { Card } from '@material-ui/core';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import { TextField } from '@material-ui/core';
import FormGroup from '@material-ui/core/FormGroup';
import Checkbox from '@material-ui/core/Checkbox';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Grid from '@material-ui/core/Grid';
import ThreeDRotationIcon from '@material-ui/icons/ThreeDRotation';
import SvgIcon from '@material-ui/core/SvgIcon';
import FourKIcon from '@material-ui/icons/FourK';
import ThreeSixtyIcon from '@material-ui/icons/ThreeSixty';
import Modal from '@material-ui/core/Modal';
import Pagination from '@material-ui/lab/Pagination';
import Popover from '@material-ui/core/Popover';
import CircularProgress from '@material-ui/core/CircularProgress';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import Tooltip from '@material-ui/core/Tooltip';


function rand() {
    return Math.round(Math.random() * 20) - 10;
  }
  
function getModalStyle() {
    const top = 50 + rand();
    const left = 50 + rand();

    return {
        top: `${top}%`,
        left: `${left}%`,
        transform: `translate(-${top}%, -${left}%)`,
    };
}

function createData(name, calories, fat, carbs, protein) {
    return { name, calories, fat, carbs, protein };
}
  
const rows = [
    createData('Frozen yoghurt', 159, 6.0, 24, 4.0),
    createData('Ice cream sandwich', 237, 9.0, 37, 4.3),
    createData('Eclair', 262, 16.0, 24, 6.0),
    createData('Cupcake', 305, 3.7, 67, 4.3),
    createData('Gingerbread', 356, 16.0, 49, 3.9),
];
  
  const useStylesBootstrap = makeStyles((theme) => ({
    arrow: {
      color: theme.palette.common.black,
    },
    tooltip: {
      backgroundColor: theme.palette.common.black,
    },
  }));

  function BootstrapTooltip(props) {
    const classes = useStylesBootstrap();
  
    return <Tooltip arrow classes={classes} {...props} />;
  }
  
  const HtmlTooltip = withStyles((theme) => ({
    tooltip: {
      backgroundColor: '#f5f5f9',
      color: 'rgba(0, 0, 0, 0.87)',
      maxWidth: 220,
      fontSize: theme.typography.pxToRem(12),
      border: '1px solid #dadde9',
    },
  }))(Tooltip);

const useStyles = makeStyles((theme) => { return {
    button: {
        background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
        border: 0,
        borderRadius: 3,
        boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
        color: 'white',
        height: 48,
        padding: '0 30px',
    },
    card: {
        minWidth: 275,
        width: '300px',
    },
    bullet: {
        display: 'inline-block',
        margin: '0 2px',
        transform: 'scale(0.8)',
    },
    title: {
        fontSize: 14,
    },
    pos: {
        marginBottom: 12,
    },
    form: {
        '& > *': {
            margin: theme.spacing(1),
            width: '25ch',
        },
    },
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
        selectEmpty: {
        marginTop: theme.spacing(2),
    },
    buttonGroup: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        '& > *': {
        margin: theme.spacing(1),
        },
    },
    accordion: {
        width: '600px',
    },
        heading: {
        fontSize: theme.typography.pxToRem(15),
        fontWeight: theme.typography.fontWeightRegular,
    },
    paper: {
        position: 'absolute',
        width: 400,
        backgroundColor: theme.palette.background.paper,
        border: '2px solid #000',
        boxShadow: theme.shadows[5],
        padding: theme.spacing(2, 4, 3),
    },
    pagination: {
        '& > *': {
            marginTop: theme.spacing(2),
        },
    },
    typographyPop: {
        padding: theme.spacing(2),
    },  
    progress: {
        display: 'flex',
        '& > * + *': {
            marginLeft: theme.spacing(2),
        },
    },  
    table: {
        minWidth: 650,
        width: 900,
    },
    tooltip: {
        backgroundColor: theme.palette.common.white,
        color: 'rgba(0, 0, 0, 0.87)',
        boxShadow: theme.shadows[1],
        fontSize: 11,
    },
}});

const Material = (props) => {

    const [checked, setChecked] = useState(true);

    const handleCheck = (event) => {
      setChecked(event.target.checked);
    };

    const [value, setValue] = useState('female');

    const handleRadio = (event) => {
      setValue(event.target.value);
    };

    const [age, setAge] = useState('');

    const handleSelect = (event) => {
      setAge(event.target.value);
    };

    const [anchorEl, setAnchorEl] = React.useState(null);

    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
      };
    
      const handleClose = () => {
        setAnchorEl(null);
      };

    const classes = useStyles();

    const bull = <span className={classes.bullet}>•</span>;

    function HomeIcon(props) {
        return (
          <SvgIcon {...props}>
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </SvgIcon>
        );
      }

      const [modalStyle] = React.useState(getModalStyle);
      const [open, setOpen] = React.useState(false);

      const modalBody = (
        <div style={modalStyle} className={classes.paper}>
          <h2 id="simple-modal-title">Text in a modal</h2>
          <p id="simple-modal-description">
            Duis mollis, est non commodo luctus, nisi erat porttitor ligula.
          </p>
          {/* <SimpleModal /> */}
        </div>
      );

      const handleModalOpen = () => {
        setOpen(true);
      };
    
      const handleModalClose = () => {
        setOpen(false);
      };

      const [anchorElPop, setAnchorElPop] = React.useState(null);

      const handleClickPop = (event) => {
        setAnchorEl(event.currentTarget);
      };
    
      const handleClosePop = () => {
        setAnchorEl(null);
      };
    
      const openPop = Boolean(anchorElPop);
      const idPop = openPop ? 'simple-popover' : undefined;

      const LightTooltip = withStyles((theme) => ({
        tooltip: {
          backgroundColor: theme.palette.common.white,
          color: 'rgba(0, 0, 0, 0.87)',
          boxShadow: theme.shadows[1],
          fontSize: 11,
        },
      }))(Tooltip);

    return (
        <>
            <p>Examples of Material-UI components.</p>

            <h3>Button</h3>
            <Button className={classes.button} color="primary">Hello World</Button>

            <h3>Alert</h3>
            <Alert severity="success" color="info" className="alertClass">
                This is a success alert — check it out!
            </Alert>

            <h3>Accordion</h3>
            <div className={classes.accordion}>
                <Accordion>
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                    <Typography className={classes.heading}>Accordion 1</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                    <Typography>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse malesuada lacus ex,
                        sit amet blandit leo lobortis eget.
                    </Typography>
                    </AccordionDetails>
                </Accordion>
                <Accordion>
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel2a-content"
                    id="panel2a-header"
                    >
                    <Typography className={classes.heading}>Accordion 2</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                    <Typography>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse malesuada lacus ex,
                        sit amet blandit leo lobortis eget.
                    </Typography>
                    </AccordionDetails>
                </Accordion>
                <Accordion disabled>
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel3a-content"
                    id="panel3a-header"
                    >
                    <Typography className={classes.heading}>Disabled Accordion</Typography>
                    </AccordionSummary>
                </Accordion>
                </div>                  
            <h3>Card</h3>
            <Card className={classes.card} variant="outlined">
                <CardContent>
                    <Typography className={classes.title} color="textSecondary" gutterBottom>
                    Word of the Day
                    </Typography>
                    <Typography variant="h5" component="h2">
                    be{bull}nev{bull}o{bull}lent
                    </Typography>
                    <Typography className={classes.pos} color="textSecondary">
                    adjective
                    </Typography>
                    <Typography variant="body2" component="p">
                    well meaning and kindly.
                    <br />
                    {'"a benevolent smile"'}
                    </Typography>
                </CardContent>
                <CardActions>
                    <Button size="small">Learn More</Button>
                </CardActions>
            </Card>

            <h3>Menu</h3>
            <div>
                <Button aria-controls="simple-menu" aria-haspopup="true" onClick={handleMenu}>
                    Open Menu
                </Button>
                <Menu
                    id="simple-menu"
                    anchorEl={anchorEl}
                    keepMounted
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                >
                    <MenuItem onClick={handleClose}>Profile</MenuItem>
                    <MenuItem onClick={handleClose}>My account</MenuItem>
                    <MenuItem onClick={handleClose}>Logout</MenuItem>
                </Menu>
            </div>

            <h3>Form</h3>
            <form className={classes.form} noValidate autoComplete="off">
                <TextField id="standard-basic" label="Standard" />
                <TextField id="filled-basic" label="Filled" variant="filled" />
                <TextField id="outlined-basic" label="Outlined" variant="outlined" />
                <FormGroup row>
                    <Checkbox
                        checked={checked}
                        onChange={handleCheck}
                        inputProps={{ 'aria-label': 'primary checkbox' }}
                    />
                </FormGroup>
                <RadioGroup aria-label="gender" name="gender1" value={value} onChange={handleRadio}>
                    <FormControlLabel value="female" control={<Radio />} label="Female" />
                    <FormControlLabel value="male" control={<Radio />} label="Male" />
                    <FormControlLabel value="other" control={<Radio />} label="Other" />
                    <FormControlLabel value="disabled" disabled control={<Radio />} label="(Disabled option)" />
                </RadioGroup>
                <FormControl className={classes.formControl}>
                    <InputLabel shrink id="demo-simple-select-placeholder-label-label">
                    Age
                    </InputLabel>
                    <Select
                    labelId="demo-simple-select-placeholder-label-label"
                    id="demo-simple-select-placeholder-label"
                    value={age}
                    onChange={handleSelect}
                    displayEmpty
                    className={classes.selectEmpty}
                    >
                    <MenuItem value="">
                        <em>None</em>
                    </MenuItem>
                    <MenuItem value={10}>Ten</MenuItem>
                    <MenuItem value={20}>Twenty</MenuItem>
                    <MenuItem value={30}>Thirty</MenuItem>
                    </Select>
                    <FormHelperText>Label + placeholder</FormHelperText>
                    <div className={classes.buttonGroup}>
                        <ButtonGroup  className={classes.buttonGroup} variant="contained" color="primary" aria-label="contained primary button group">
                            <Button>One</Button>
                            <Button>Two</Button>
                            <Button>Three</Button>
                        </ButtonGroup>
                    </div>
                </FormControl>
            </form>

            <h3>Icons</h3>
            <Grid item xs={8}>
                <ThreeDRotationIcon color="action" />
                <HomeIcon fontSize="large" />
                <FourKIcon color="secondary" fontSize="large" />
                <ThreeSixtyIcon style={{ fontSize: 128 }} />
            </Grid>

            <h3>Modal</h3>
            <div>
                <button type="button" onClick={handleModalOpen}>
                    Open Modal
                </button>
                <Modal
                    open={open}
                    onClose={handleModalClose}
                    aria-labelledby="simple-modal-title"
                    aria-describedby="simple-modal-description"
                >
                    {modalBody}
                </Modal>
            </div>

            <h3>Pagination</h3>
            <div className={classes.pagination}>
                <Pagination count={10} color="primary" />
            </div>

            <h3>Popover</h3>
            <div>
                <Button aria-describedby={idPop} variant="contained" color="primary" onClick={handleClickPop}>
                    Open Popover
                </Button>
                <Popover
                    id={idPop}
                    open={openPop}
                    anchorEl={anchorElPop}
                    onClose={handleClosePop}
                    anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                    }}
                    transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                    }}
                >
                    <Typography className={classes.typographyPop}>The content of the Popover.</Typography>
                </Popover>
            </div>

            <h3>Progress</h3>
            <CircularProgress />

            <h3>Table</h3>
            <TableContainer component={Paper}>
                <Table className={classes.table} aria-label="simple table">
                    <TableHead>
                    <TableRow>
                        <TableCell>Dessert (100g serving)</TableCell>
                        <TableCell align="right">Calories</TableCell>
                        <TableCell align="right">Fat&nbsp;(g)</TableCell>
                        <TableCell align="right">Carbs&nbsp;(g)</TableCell>
                        <TableCell align="right">Protein&nbsp;(g)</TableCell>
                    </TableRow>
                    </TableHead>
                    <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.name}>
                        <TableCell component="th" scope="row">
                            {row.name}
                        </TableCell>
                        <TableCell align="right">{row.calories}</TableCell>
                        <TableCell align="right">{row.fat}</TableCell>
                        <TableCell align="right">{row.carbs}</TableCell>
                        <TableCell align="right">{row.protein}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <h3>Tooltip</h3>
            <div>
                <LightTooltip title="Add">
                    <Button>Light</Button>
                </LightTooltip>
                <BootstrapTooltip title="Add">
                    <Button>Bootstrap</Button>
                </BootstrapTooltip>
                <HtmlTooltip
                    title={
                    <React.Fragment>
                        <Typography color="inherit">Tooltip with HTML</Typography>
                        <em>{"And here's"}</em> <b>{'some'}</b> <u>{'amazing content'}</u>.{' '}
                        {"It's very engaging. Right?"}
                    </React.Fragment>
                    }
                >
                    <Button>HTML</Button>
                </HtmlTooltip>
            </div>

        </>
    );
};

export default Material;
