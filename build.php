<?php

$start = microtime(true);

// Super strict, fail on warning
error_reporting(E_ALL);
ini_set('display_errors', 1);
function exception_error_handler($errno, $errstr, $errfile, $errline ) {
    throw new ErrorException($errstr, $errno, 0, $errfile, $errline);
}
set_error_handler("exception_error_handler");

// interfaces
include 'src/Linkable.php';
include 'src/Page.php';
include 'src/PageContent.php';

// classes
include 'src/Documentation.php';
include 'src/ExternalPage.php';
include 'src/Header.php';
include 'src/InternalPage.php';
include 'src/Link.php';
include 'src/Links.php';
include 'src/Navigation.php';
include 'src/OronjoBuy.php';
include 'src/PageFactory.php';
include 'src/SimpleContent.php';
include 'src/Site.php';
include 'src/SoftwareContent.php';

$pages = new PageFactory();

$navigation = new Navigation($pages->home());
$navigation->addItem($pages->music())
    ->addDropdown('Software', array_merge(array($pages->software()), $pages->linkedSoftwarePages()))
    ->addItem($pages->contact());

$site = new Site(
    array(
        $pages->home(),
        $pages->music(),
        $pages->contact(),
        $pages->software(),
        $pages->error(),
        $pages->m4lWAI(),
        $pages->m4lDSM(),
        $pages->m4lMCM(),
        $pages->wacNetworkMidi(),
        $pages->miniakPatchEditor()
    ),
    $navigation
);

$site->clearLastBuild();
$site->render();

echo sprintf("Site built in %fms\n", microtime(true) - $start);
