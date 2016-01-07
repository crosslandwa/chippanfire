<?php

final class SoftwareContent {
    private $_contentFilename;
    private $_image;
    private $_documentationFile;

    public function __construct($contentFilename, $image, $documentationFile) {
        $this->_contentFilename = $contentFilename;
        $this->_image = $image;
        $this->_documentationFile = $documentationFile;
    }

    public function render($page) {
        require 'template/content-software-wrapper.phtml';
    }

    private function headlineImage() {
        return $this->_image;
    }

    private function _renderMainContent(Page $page) {
        require 'template/' . $this->_contentFilename;
    }

    private function _documentation() {
        return new Documentation($this->_documentationFile);
    }

    private function _download($text, $item) {
        // TODO Free items (demos etc) to be located on my server, not Oronjo
        return '<a href="http://www.oronjo.com/live/next/?fi=' . $item . '" target="_blank">'
            . '<button type="submit" class="btn btn-primary">' . $text . '</button>'
            . '</a>';
    }
}
